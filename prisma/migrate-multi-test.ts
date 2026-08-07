// One-off backfill for the multi-test-per-course change.
// Run AFTER `npx prisma db push` has added Test.title/Test.order/TestProgress
// (while the old CourseProgress.testScore/testStatus columns still exist),
// and BEFORE the follow-up `db push` that drops those old columns.
//
//   npx tsx --env-file=.env prisma/migrate-multi-test.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

async function main() {
  // 1. Give every existing Test a title and place it after all of its course's content.
  const tests = await prisma.test.findMany({ select: { id: true, courseId: true } })
  for (const test of tests) {
    const maxContentOrder = await prisma.content.aggregate({
      where: { courseId: test.courseId, deletedAt: null },
      _max: { order: true },
    })
    const order = (maxContentOrder._max.order ?? 0) + 1
    await prisma.$executeRawUnsafe(
      `UPDATE "Test" SET "title" = 'Test', "order" = $1 WHERE "id" = $2`,
      order,
      test.id
    )
  }
  console.log(`Backfilled title/order for ${tests.length} test(s).`)

  // 2. Copy CourseProgress.testScore/testStatus into TestProgress, one row per
  // (user, that course's test, pathway). Safe to run only while the old columns
  // still exist on CourseProgress.
  const progressRows: { userId: string; courseId: string; pathwayId: string; testScore: number | null; testStatus: string | null; completedAt: Date | null }[] =
    await prisma.$queryRawUnsafe(
      `SELECT "userId", "courseId", "pathwayId", "testScore", "testStatus", "completedAt" FROM "CourseProgress" WHERE "testScore" IS NOT NULL`
    )

  let migrated = 0
  for (const row of progressRows) {
    const test = await prisma.test.findFirst({ where: { courseId: row.courseId }, select: { id: true } })
    if (!test) continue
    await prisma.testProgress.upsert({
      where: { userId_testId_pathwayId: { userId: row.userId, testId: test.id, pathwayId: row.pathwayId } },
      create: {
        userId: row.userId,
        testId: test.id,
        pathwayId: row.pathwayId,
        score: row.testScore ?? 0,
        status: (row.testStatus as "PASSED" | "FAILED") ?? "FAILED",
        completedAt: row.completedAt ?? new Date(),
      },
      update: {},
    })
    migrated++
  }
  console.log(`Migrated ${migrated} CourseProgress test result(s) into TestProgress.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
