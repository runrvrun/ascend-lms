// One-off backfill for the multi-assignment-per-course change.
// Run AFTER `npx prisma db push` has added Assignment.title/Assignment.order.
// Places each live assignment that has no position yet after all of its course's
// content and tests. Idempotent: only touches live assignments whose order is null.
//
//   npx tsx --env-file=.env prisma/migrate-multi-assignment.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

async function main() {
  const assignments = await prisma.assignment.findMany({
    where: { deletedAt: null, order: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, courseId: true },
  })
  for (const a of assignments) {
    const [c, t, as] = await Promise.all([
      prisma.content.aggregate({ where: { courseId: a.courseId, deletedAt: null }, _max: { order: true } }),
      prisma.test.aggregate({ where: { courseId: a.courseId, deletedAt: null }, _max: { order: true } }),
      prisma.assignment.aggregate({ where: { courseId: a.courseId, deletedAt: null }, _max: { order: true } }),
    ])
    const order = Math.max(c._max.order ?? 0, t._max.order ?? 0, as._max.order ?? 0) + 1
    await prisma.assignment.update({ where: { id: a.id }, data: { order } })
  }
  console.log(`Placed ${assignments.length} assignment(s) at the end of their course.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
