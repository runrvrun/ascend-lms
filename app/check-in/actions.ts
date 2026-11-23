"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../lib/prisma"
import { getSessionUser } from "../lib/permissions"
import { DEADLINE_GRACE_DAYS } from "../lib/pathwayDeadline"
import { markInPersonComplete, normalizeCheckInCode } from "../lib/inPersonAttendance"

export type CheckInResult =
  | { ok: true; title: string; courseName: string; pathwayId: string | null; already: boolean }
  | { ok: false; error: string }

// A learner checks in to an in-person session with its code (from the printed QR, or
// typed in). Counts for every pathway they're enrolled in that has the course, except
// ones locked by their deadline.
export async function checkIn(rawCode: string): Promise<CheckInResult> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: "Please sign in first." }
  const code = normalizeCheckInCode(rawCode)
  const content = code
    ? await prisma.content.findFirst({
        where: { checkInCode: code, deletedAt: null, type: "IN_PERSON", course: { deletedAt: null } },
        select: { id: true, courseId: true, title: true, course: { select: { name: true } } },
      })
    : null
  if (!content) return { ok: false, error: "That check-in code isn't valid. Check it and try again." }

  const already = await prisma.contentProgress.findFirst({ where: { userId: user.id, contentId: content.id }, select: { pathwayId: true } })
  const { marked, locked } = await markInPersonComplete(user.id, content, { method: "CHECK_IN", markedById: null, respectLock: true })
  if (marked === 0) {
    return {
      ok: false,
      error: locked
        ? `Your pathway with this session closed ${DEADLINE_GRACE_DAYS} days after its deadline, so attendance can't be recorded. Ask your trainer or an admin.`
        : `You're not enrolled in a pathway that includes "${content.course.name}". Ask your trainer or an admin to enroll you, then scan again.`,
    }
  }
  const progress = await prisma.contentProgress.findFirst({ where: { userId: user.id, contentId: content.id }, select: { pathwayId: true } })
  revalidatePath("/pathways/[id]", "page")
  revalidatePath("/dashboard")
  return { ok: true, title: content.title, courseName: content.course.name, pathwayId: progress?.pathwayId ?? null, already: !!already }
}
