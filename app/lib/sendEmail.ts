import { after } from "next/server"
import { prisma } from "./prisma"
import { enqueueEmails, processOutbox, type EmailMessage } from "./emailOutbox"

// Queue emails from a server action, then start sending once the response is out, so a
// slow mail server never blocks the UI. Anything over the rate limit, and any retry, is
// sent by the send-emails cron (scripts/send-emails.ts).
// Pass bulk for mass sends so they queue behind one-off emails.
export async function sendEmails(messages: EmailMessage[], opts: { bulk?: boolean } = {}) {
  if (!messages.length) return
  await enqueueEmails(prisma, messages, opts)
  after(() => processOutbox(prisma).catch((err) => console.error("[email] Outbox run failed:", err)))
}
