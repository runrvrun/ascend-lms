import type { Metadata } from "next"
export const metadata: Metadata = { title: "Email Log" }

import type { EmailStatus, Prisma } from "@prisma/client"
import { prisma } from "../../lib/prisma"
import { EMAIL_PER_DAY } from "../../lib/emailOutbox"
import { EmailLog } from "./EmailLog"

const PAGE_SIZE = 50
const STATUSES: EmailStatus[] = ["PENDING", "SENDING", "SENT", "FAILED"]

const countSentInLastDay = () =>
  prisma.emailOutbox.count({ where: { status: "SENT", sentAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } })

export default async function AdminEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const status = STATUSES.find((s) => s === params.status)
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.EmailOutboxWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { to: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const [emails, total, statusCounts, sentLastDay] = await Promise.all([
    prisma.emailOutbox.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        bulk: true,
        attempts: true,
        nextAttemptAt: true,
        sentAt: true,
        lastError: true,
        createdAt: true,
      },
    }),
    prisma.emailOutbox.count({ where }),
    prisma.emailOutbox.groupBy({ by: ["status"], _count: true }),
    countSentInLastDay(),
  ])

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<EmailStatus, number>
  for (const c of statusCounts) counts[c.status] = c._count

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <EmailLog
        emails={emails.map((e) => ({
          ...e,
          nextAttemptAt: e.nextAttemptAt.toISOString(),
          sentAt: e.sentAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
        }))}
        counts={counts}
        sentLastDay={sentLastDay}
        dailyLimit={EMAIL_PER_DAY}
        filters={{ q, status: status ?? "" }}
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
      />
    </main>
  )
}
