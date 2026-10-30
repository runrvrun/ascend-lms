// Emails learners whose pathway deadline is tomorrow or today and who haven't
// finished the pathway yet. Sent regardless of emailReminderOptIn (that opt-in
// covers the weekly digest), like the pathway-assigned email. Must run exactly
// once a day via cron — it has no sent-tracking, it just matches by date:
//
//   0 1 * * *  cd ~/ascend-lms && npm run send-deadline-reminders   (01:00 UTC = 09:00 SGT)
//
// Pass --dry-run to only list who would be emailed.
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { deadlineReminderEmail } from "../app/lib/email"
import { enqueueEmails } from "../app/lib/emailOutbox"
import { addDays, startOfUtcDay, DEADLINE_GRACE_DAYS } from "../app/lib/pathwayDeadline"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://ycp-ascend-lms.vercel.app"
const dryRun = process.argv.includes("--dry-run")

async function main() {
  const today = startOfUtcDay(new Date())
  const tomorrow = addDays(today, 1)

  const enrollments = await prisma.pathwayEnrollment.findMany({
    where: {
      status: "APPROVED",
      deadline: { gte: today, lt: addDays(tomorrow, 1) },
      user: { deletedAt: null, status: "ACTIVE", email: { not: null } },
      pathway: { deletedAt: null, status: "PUBLISHED" },
    },
    select: {
      userId: true,
      pathwayId: true,
      deadline: true,
      user: { select: { name: true, email: true } },
      pathway: {
        select: {
          name: true,
          courses: {
            where: { course: { deletedAt: null, status: "PUBLISHED" } },
            orderBy: { order: "asc" },
            select: { course: { select: { id: true } } },
          },
        },
      },
    },
  })

  const completedProgress = enrollments.length
    ? await prisma.courseProgress.findMany({
        where: {
          completed: true,
          OR: enrollments.map((e) => ({ userId: e.userId, pathwayId: e.pathwayId })),
        },
        select: { userId: true, pathwayId: true, courseId: true },
      })
    : []
  const completedSet = new Set(completedProgress.map((p) => `${p.userId}:${p.pathwayId}:${p.courseId}`))

  const due = enrollments
    .map((e) => ({
      ...e,
      nextCourseId: e.pathway.courses.find((pc) => !completedSet.has(`${e.userId}:${e.pathwayId}:${pc.course.id}`))?.course.id,
    }))
    .filter((e) => e.nextCourseId) // pathway already finished — nothing to remind about

  const isDueToday = (e: (typeof due)[number]) => startOfUtcDay(e.deadline!).getTime() === today.getTime()
  if (dryRun) {
    for (const e of due) console.log(`  would email ${e.user.email}: "${e.pathway.name}" due ${isDueToday(e) ? "today" : "tomorrow"}`)
  } else {
    // Queued; the send-emails cron delivers them within the mail server's rate limit.
    await enqueueEmails(
      prisma,
      due.map((e) =>
        deadlineReminderEmail(
          e.user.email!,
          e.user.name ?? "there",
          e.pathway.name,
          e.deadline!,
          isDueToday(e),
          DEADLINE_GRACE_DAYS,
          `${BASE_URL}/pathways/${e.pathwayId}?course=${e.nextCourseId}`
        )
      ),
      { bulk: true }
    )
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}Deadline reminders: ${enrollments.length} enrollment(s) due today/tomorrow, ${due.length} unfinished, ${dryRun ? 0 : due.length} email(s) queued.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
