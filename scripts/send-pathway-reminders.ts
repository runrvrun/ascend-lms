// Sends a cheerful reminder email to every learner with an incomplete pathway,
// pointing them at their next course. Intended to run on a schedule (cron),
// weekly (Wednesdays), against the production DB.
//
// Enrollments whose deadline day has already passed are skipped — those learners
// got their deadline reminders (scripts/send-deadline-reminders.ts) instead.
//
//   npx tsx --env-file=.env scripts/send-pathway-reminders.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { sendLearningReminder } from "../app/lib/email"
import { pickMessage, sendThrottled } from "../app/lib/pathwayReminders"
import { startOfUtcDay } from "../app/lib/pathwayDeadline"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://ycp-ascend-lms.vercel.app"

async function main() {
  const enrollments = await prisma.pathwayEnrollment.findMany({
    where: {
      status: "APPROVED",
      user: { deletedAt: null, status: "ACTIVE", email: { not: null }, emailReminderOptIn: true },
      pathway: { deletedAt: null, status: "PUBLISHED" },
      OR: [{ deadline: null }, { deadline: { gte: startOfUtcDay(new Date()) } }],
    },
    select: {
      userId: true,
      pathwayId: true,
      deadline: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      pathway: {
        select: {
          id: true,
          name: true,
          courses: {
            where: { course: { deletedAt: null, status: "PUBLISHED" } },
            orderBy: { order: "asc" },
            select: { course: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  const pathwayIds = [...new Set(enrollments.map((e) => e.pathwayId))]
  const completedProgress = await prisma.courseProgress.findMany({
    where: { completed: true, pathwayId: { in: pathwayIds } },
    select: { userId: true, pathwayId: true, courseId: true },
  })
  const completedSet = new Set(completedProgress.map((p) => `${p.userId}:${p.pathwayId}:${p.courseId}`))

  type OpenPathway = {
    pathwayId: string
    pathwayName: string
    nextCourseId: string
    nextCourseName: string
    deadline: Date | null
    createdAt: Date
  }
  const openPathwaysByUser = new Map<string, { name: string | null; email: string; pathways: OpenPathway[] }>()

  for (const e of enrollments) {
    const nextEntry = e.pathway.courses.find(
      (pc) => !completedSet.has(`${e.userId}:${e.pathwayId}:${pc.course.id}`)
    )
    if (!nextEntry) continue // every course in this pathway is complete

    const bucket = openPathwaysByUser.get(e.userId) ?? { name: e.user.name, email: e.user.email!, pathways: [] }
    bucket.pathways.push({
      pathwayId: e.pathway.id,
      pathwayName: e.pathway.name,
      nextCourseId: nextEntry.course.id,
      nextCourseName: nextEntry.course.name,
      deadline: e.deadline,
      createdAt: e.createdAt,
    })
    openPathwaysByUser.set(e.userId, bucket)
  }

  const recipients = [...openPathwaysByUser.values()]
  recipients.forEach((r) =>
    r.pathways.sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime()
      if (a.deadline) return -1
      if (b.deadline) return 1
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  )

  let sent = 0
  await sendThrottled(recipients, 600, async (r) => {
    const first = r.pathways[0]
    const startLearningUrl = `${BASE_URL}/pathways/${first.pathwayId}?course=${first.nextCourseId}`
    await sendLearningReminder(
      r.email,
      r.name ?? "there",
      pickMessage(),
      r.pathways.map((p) => ({ pathwayId: p.pathwayId, pathwayName: p.pathwayName, nextCourseName: p.nextCourseName })),
      startLearningUrl
    )
    sent++
  })

  console.log(
    `Pathway reminders: ${enrollments.length} enrollment(s) considered, ${recipients.length} learner(s) with open pathways, ${sent} email(s) sent.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
