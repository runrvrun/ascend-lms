// Email queue. Every email is first written to the EmailOutbox table, then sent by
// processOutbox() — kicked right after a server action queues mail, and every minute by
// the send-emails cron (scripts/send-emails.ts), which also picks up retries.
//
// Shared with the cron scripts, so it takes the Prisma client as a parameter instead of
// importing the app/lib/prisma.ts singleton.
//
// Transport: SMTP when SMTP_HOST is set (production), otherwise the Mailtrap sandbox (dev).

import nodemailer from "nodemailer"
import type { PrismaClient } from "@prisma/client"

export type EmailMessage = { to: string; subject: string; html: string }

// Production mail server allows 30/minute and 10,000/day per mailbox; stay well under both.
// Windows are rolling (last 60 seconds / last 24 hours), like the server's own.
export const EMAIL_PER_MINUTE = 20
export const EMAIL_PER_DAY = 9000

// Wait before retry n (after attempt n failed). After the last one the email is FAILED.
const RETRY_DELAYS_MIN = [5, 30, 120, 360]
const MAX_ATTEMPTS = RETRY_DELAYS_MIN.length + 1

// A row left in SENDING this long belongs to a run that died mid-send; put it back in the queue.
const STALE_SENDING_MS = 10 * 60_000

// Arbitrary key for the Postgres advisory lock that lets only one processOutbox claim at a time.
const OUTBOX_LOCK_KEY = 74_201_377

// Queue emails. `bulk` mail (mass assignments, reminders) waits behind one-off mail such as
// account activation, so a big send never holds those up.
export async function enqueueEmails(db: PrismaClient, messages: EmailMessage[], opts: { bulk?: boolean } = {}) {
  if (!messages.length) return
  await db.emailOutbox.createMany({
    data: messages.map((m) => ({ to: m.to, subject: m.subject, html: m.html, bulk: opts.bulk ?? false })),
  })
}

type ClaimedEmail = { id: string; to: string; subject: string; html: string; attempts: number }

// Sends as many due emails as the rate limits allow right now, then returns. Whatever is
// left goes out on a later run. Safe to call concurrently: the claim step is serialized.
export async function processOutbox(db: PrismaClient): Promise<{ sent: number; failed: number }> {
  if (!process.env.SMTP_HOST && !(process.env.MAILTRAP_TOKEN && process.env.MAILTRAP_INBOX_ID)) {
    console.warn("[email] No email provider configured — leaving queued emails unsent")
    return { sent: 0, failed: 0 }
  }

  const batch = await claimBatch(db)
  let sent = 0
  let failed = 0
  for (const email of batch) {
    try {
      await deliver(email)
      await db.emailOutbox.update({
        where: { id: email.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      })
      sent++
    } catch (err) {
      const giveUp = email.attempts >= MAX_ATTEMPTS
      console.error(`[email] Send to ${email.to} failed (attempt ${email.attempts}${giveUp ? ", giving up" : ""}):`, err)
      await db.emailOutbox.update({
        where: { id: email.id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(Date.now() + (giveUp ? 0 : RETRY_DELAYS_MIN[email.attempts - 1] * 60_000)),
          lastError: String(err instanceof Error ? err.message : err).slice(0, 1000),
        },
      })
      failed++
    }
  }
  return { sent, failed }
}

async function claimBatch(db: PrismaClient): Promise<ClaimedEmail[]> {
  return db.$transaction(
    async (tx) => {
      // Another run is claiming right now; it will take what the rate limit allows anyway.
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${OUTBOX_LOCK_KEY}) AS locked`
      if (!locked) return []

      const now = new Date()
      const stale = await tx.emailOutbox.findMany({
        where: { status: "SENDING", claimedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
        select: { id: true, attempts: true },
      })
      for (const row of stale) {
        await tx.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: row.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
            nextAttemptAt: now,
            lastError: "Interrupted while sending",
          },
        })
      }

      // Emails sent, or being sent, inside a window count against that window's limit.
      const usedSince = (ms: number) => {
        const since = new Date(now.getTime() - ms)
        return tx.emailOutbox.count({
          where: {
            OR: [
              { status: "SENT", sentAt: { gte: since } },
              { status: "SENDING", claimedAt: { gte: since } },
            ],
          },
        })
      }
      const [lastMinute, lastDay] = await Promise.all([usedSince(60_000), usedSince(24 * 60 * 60_000)])
      const budget = Math.min(EMAIL_PER_MINUTE - lastMinute, EMAIL_PER_DAY - lastDay)
      if (budget <= 0) return []

      const due = await tx.emailOutbox.findMany({
        where: { status: "PENDING", nextAttemptAt: { lte: now } },
        orderBy: [{ bulk: "asc" }, { createdAt: "asc" }],
        take: budget,
        select: { id: true, to: true, subject: true, html: true, attempts: true },
      })
      if (!due.length) return []

      await tx.emailOutbox.updateMany({
        where: { id: { in: due.map((e) => e.id) } },
        data: { status: "SENDING", claimedAt: now, attempts: { increment: 1 } },
      })
      return due.map((e) => ({ ...e, attempts: e.attempts + 1 }))
    },
    { timeout: 30_000 }
  )
}

// Keep a year of history to answer "did X get the email?", then drop it.
export async function purgeOldEmails(db: PrismaClient) {
  const { count } = await db.emailOutbox.deleteMany({
    where: { status: { in: ["SENT", "FAILED"] }, createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60_000) } },
  })
  return count
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      // 465 = TLS from the start; 587 (e.g. Office 365) = STARTTLS upgrade.
      secure: Number(process.env.SMTP_PORT) === 465,
      requireTLS: Number(process.env.SMTP_PORT) !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      // Nodemailer's defaults wait up to 2 minutes on an unreachable server.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    })
  }
  return transporter
}

// Throws on failure so processOutbox can schedule a retry.
async function deliver({ to, subject, html }: EmailMessage) {
  if (process.env.SMTP_HOST) {
    await getTransporter().sendMail({
      // SMTP_FROM lets the login account send as another address (needs Send As rights).
      from: `Ascend LMS <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    return
  }

  const res = await fetch(`https://sandbox.api.mailtrap.io/api/send/${process.env.MAILTRAP_INBOX_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MAILTRAP_TOKEN}`,
    },
    body: JSON.stringify({
      from: { email: "noreply@ascend.ycp.com", name: "Ascend LMS" },
      to: [{ email: to }],
      subject,
      html,
    }),
  })
  if (!res.ok) throw new Error(`Mailtrap error ${res.status}: ${await res.text()}`)
}
