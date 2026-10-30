"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { prisma } from "../../lib/prisma"
import { requireAdmin } from "../../lib/permissions"
import { processOutbox } from "../../lib/emailOutbox"

// Puts failed emails back in the queue as if new (fresh retry budget) and starts sending.
// Only FAILED rows are touched, so a double click can't resend an email that already went.
async function requeueFailed(where: { id?: string }) {
  const { count } = await prisma.emailOutbox.updateMany({
    where: { ...where, status: "FAILED" },
    data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  })
  if (count > 0) after(() => processOutbox(prisma).catch((err) => console.error("[email] Outbox run failed:", err)))
  revalidatePath("/admin/email")
  return count
}

export async function resendEmail(id: string) {
  await requireAdmin()
  return requeueFailed({ id })
}

export async function resendAllFailed() {
  await requireAdmin()
  return requeueFailed({})
}

export async function getEmailHtml(id: string): Promise<string | null> {
  await requireAdmin()
  const email = await prisma.emailOutbox.findUnique({ where: { id }, select: { html: true } })
  return email?.html ?? null
}
