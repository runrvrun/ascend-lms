// Sends admin-scheduled, one-off reminder emails for a specific pathway
// enrollment or an entire cohort's enrollment in a pathway. Only sends to
// learners who haven't completed the pathway yet. Runs hourly via cron —
// each PathwayReminder is only ever processed once (sentAt gets set).
//
//   npx tsx --env-file=.env scripts/send-custom-pathway-reminders.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { learningReminderEmail } from "../app/lib/email"
import type { EmailMessage } from "../app/lib/emailOutbox"
import { pickMessage } from "../app/lib/pathwayReminders"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://ycp-ascend-lms.vercel.app"

type Target = {
  userId: string
  name: string | null
  email: string
}

async function resolveTargets(reminder: {
  pathwayId: string
  enrollmentId: string | null
  cohortPathwayId: string | null
}): Promise<Target[]> {
  const eligibleWhere = {
    status: "APPROVED" as const,
    pathwayId: reminder.pathwayId,
    user: { deletedAt: null, status: "ACTIVE" as const, email: { not: null }, emailReminderOptIn: true },
  }

  if (reminder.enrollmentId) {
    const enrollment = await prisma.pathwayEnrollment.findFirst({
      where: { id: reminder.enrollmentId, ...eligibleWhere },
      select: { user: { select: { id: true, name: true, email: true } } },
    })
    return enrollment ? [{ userId: enrollment.user.id, name: enrollment.user.name, email: enrollment.user.email! }] : []
  }

  if (reminder.cohortPathwayId) {
    const cohortPathway = await prisma.cohortPathway.findUnique({
      where: { id: reminder.cohortPathwayId },
      select: { cohortId: true },
    })
    if (!cohortPathway) return []

    const enrollments = await prisma.pathwayEnrollment.findMany({
      where: { ...eligibleWhere, cohortId: cohortPathway.cohortId },
      select: { user: { select: { id: true, name: true, email: true } } },
    })
    return enrollments.map((e) => ({ userId: e.user.id, name: e.user.name, email: e.user.email! }))
  }

  return []
}

async function main() {
  const dueReminders = await prisma.pathwayReminder.findMany({
    where: { sentAt: null, scheduledAt: { lte: new Date() } },
    select: {
      id: true,
      pathwayId: true,
      enrollmentId: true,
      cohortPathwayId: true,
      message: true,
      pathway: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
          status: true,
          courses: {
            where: { course: { deletedAt: null, status: "PUBLISHED" } },
            orderBy: { order: "asc" },
            select: { course: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0

  for (const reminder of dueReminders) {
    if (reminder.pathway.deletedAt || reminder.pathway.status !== "PUBLISHED") {
      await prisma.pathwayReminder.update({ where: { id: reminder.id }, data: { sentAt: new Date() } })
      continue
    }

    const targets = await resolveTargets(reminder)
    const targetUserIds = targets.map((t) => t.userId)
    const completedProgress = targetUserIds.length
      ? await prisma.courseProgress.findMany({
          where: { completed: true, pathwayId: reminder.pathwayId, userId: { in: targetUserIds } },
          select: { userId: true, courseId: true },
        })
      : []
    const completedSet = new Set(completedProgress.map((p) => `${p.userId}:${p.courseId}`))

    const emails: EmailMessage[] = []
    for (const target of targets) {
      const nextEntry = reminder.pathway.courses.find((pc) => !completedSet.has(`${target.userId}:${pc.course.id}`))
      if (!nextEntry) {
        skipped++
        continue // pathway already complete for this learner
      }

      const startLearningUrl = `${BASE_URL}/pathways/${reminder.pathwayId}?course=${nextEntry.course.id}`
      emails.push(
        learningReminderEmail(
          target.email,
          target.name ?? "there",
          reminder.message ?? pickMessage(),
          [{ pathwayId: reminder.pathwayId, pathwayName: reminder.pathway.name, nextCourseName: nextEntry.course.name }],
          startLearningUrl
        )
      )
    }

    // Queued; the send-emails cron delivers them within the mail server's rate limit.
    // Queue and mark sent together so a crash can't queue the same reminder twice.
    await prisma.$transaction([
      prisma.emailOutbox.createMany({ data: emails.map((e) => ({ ...e, bulk: true })) }),
      prisma.pathwayReminder.update({ where: { id: reminder.id }, data: { sentAt: new Date() } }),
    ])
    sent += emails.length
  }

  console.log(
    `Custom pathway reminders: ${dueReminders.length} reminder(s) due, ${sent} email(s) queued, ${skipped} skipped (already completed).`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
