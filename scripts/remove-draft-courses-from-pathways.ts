// One-off cleanup for the "pathways hold only published courses" rule: removes every
// draft course from every pathway. Learner progress on those courses is kept.
//
//   npx tsx --env-file=.env scripts/remove-draft-courses-from-pathways.ts --dry-run
//   npx tsx --env-file=.env scripts/remove-draft-courses-from-pathways.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const dryRun = process.argv.includes("--dry-run")

async function main() {
  const rows = await prisma.pathwayCourse.findMany({
    where: { course: { status: "DRAFT" } },
    select: {
      id: true,
      pathway: { select: { name: true, status: true, deletedAt: true } },
      course: { select: { name: true } },
    },
    orderBy: [{ pathway: { name: "asc" } }, { order: "asc" }],
  })

  for (const r of rows) {
    const pathwayState = r.pathway.deletedAt ? "deleted" : r.pathway.status.toLowerCase()
    console.log(`  ${dryRun ? "would remove" : "removing"} "${r.course.name}" from "${r.pathway.name}" (${pathwayState} pathway)`)
  }

  if (!dryRun && rows.length) {
    await prisma.pathwayCourse.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  }
  console.log(`${dryRun ? "[dry run] " : ""}${rows.length} draft course placement(s) ${dryRun ? "found" : "removed"}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
