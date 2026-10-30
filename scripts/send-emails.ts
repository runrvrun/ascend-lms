// Sends queued emails (the EmailOutbox table) within the mail server's rate limit and
// retries failed ones (see app/lib/emailOutbox.ts). Runs every minute via cron:
//
//   * * * * *  cd ~/ascend-lms && npm run send-emails
//
// Pass --dry-run to only show what is queued.
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { processOutbox, purgeOldEmails } from "../app/lib/emailOutbox"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const dryRun = process.argv.includes("--dry-run")

async function main() {
  if (dryRun) {
    const counts = await prisma.emailOutbox.groupBy({ by: ["status"], _count: true })
    const due = await prisma.emailOutbox.count({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } } })
    console.log(`[dry run] Email queue: ${counts.map((c) => `${c._count} ${c.status}`).join(", ") || "empty"}; ${due} due now.`)
    return
  }

  const { sent, failed } = await processOutbox(prisma)
  const purged = await purgeOldEmails(prisma)
  // Stay quiet on idle minutes so the cron log isn't one line per minute.
  if (sent || failed || purged) console.log(`Emails: ${sent} sent, ${failed} failed, ${purged} old record(s) purged.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
