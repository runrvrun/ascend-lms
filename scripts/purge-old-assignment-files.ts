// Deletes uploaded assignment files older than 6 months from the server's disk
// to save space. The AssignmentSubmission row is kept (with fileDeletedAt set)
// so grades, status, and course reports are unaffected. Link submissions take
// no disk space and are left alone. Intended to run monthly via cron on the
// production server (from the repo dir, so .env and UPLOAD_DIR resolve):
//
//   0 3 1 * *  cd ~/ascend-lms && npm run purge-assignment-files
//
// Pass --dry-run to only list what would be deleted.
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { deleteAssignmentFile, ASSIGNMENT_FILE_RETENTION_MONTHS, UPLOAD_DIR } from "../app/lib/assignmentFiles"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const dryRun = process.argv.includes("--dry-run")

async function main() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - ASSIGNMENT_FILE_RETENTION_MONTHS)

  const expired = await prisma.assignmentSubmission.findMany({
    where: { fileKey: { not: null }, fileDeletedAt: null, createdAt: { lt: cutoff } },
    select: { id: true, fileKey: true, fileName: true, fileSize: true, createdAt: true },
  })

  console.log(`${dryRun ? "[dry run] " : ""}${expired.length} file(s) older than ${cutoff.toISOString()} in ${UPLOAD_DIR}`)

  let freed = 0
  let failed = 0
  for (const s of expired) {
    if (dryRun) {
      console.log(`  would delete ${s.fileKey} (${s.fileName}, ${s.createdAt.toISOString()})`)
      continue
    }
    try {
      await deleteAssignmentFile(s.fileKey!)
      await prisma.assignmentSubmission.update({ where: { id: s.id }, data: { fileDeletedAt: new Date() } })
      freed += s.fileSize ?? 0
    } catch (err) {
      failed++
      console.error(`  failed to delete ${s.fileKey}:`, err)
    }
  }

  if (!dryRun) {
    console.log(`Deleted ${expired.length - failed} file(s), freed ${(freed / 1024 / 1024).toFixed(1)} MB, ${failed} failure(s)`)
  }
  if (failed) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
