// In-person sessions (IN_PERSON content) are completed in one of three ways, never by
// the learner just clicking a button:
//  - ADMIN: an admin or one of the course's trainers marks attendance;
//  - CHECK_IN: the learner scans the session's printed QR code (or types its code);
//  - RECORDING: the learner watches the session recording (toggleContentComplete).
// ContentProgress is per pathway, so marking someone covers every pathway they're
// enrolled in that contains the course.
import { randomInt } from "node:crypto"
import type { ContentCompletionMethod } from "@prisma/client"
import { prisma } from "./prisma"
import { evaluateCourseCompletion } from "./courseCompletion"
import { isDeadlineLocked } from "./pathwayDeadline"
import { getSessionUser } from "./permissions"

// Admins and the course's trainers take attendance and print the check-in QR.
export async function requireAttendanceManager(contentId: string) {
  const user = await getSessionUser()
  if (!user) throw new Error("Unauthorized")
  const content = await prisma.content.findFirst({
    where: { id: contentId, deletedAt: null, type: "IN_PERSON", course: { deletedAt: null } },
    select: { id: true, courseId: true, title: true },
  })
  if (!content) throw new Error("In-person session not found")
  if (!user.roles.includes("ADMIN")) {
    const trainer = await prisma.courseTrainer.findUnique({
      where: { courseId_userId: { courseId: content.courseId, userId: user.id } },
      select: { userId: true },
    })
    if (!trainer) throw new Error("Unauthorized")
  }
  return { user, content }
}

export async function canManageAttendance(user: { id: string; roles: string[] }, courseId: string) {
  if (user.roles.includes("ADMIN")) return true
  const trainer = await prisma.courseTrainer.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    select: { userId: true },
  })
  return !!trainer
}

// Active users' approved enrollments in live pathways that contain the course.
export async function courseEnrollments(courseId: string, userIds?: string[]) {
  return prisma.pathwayEnrollment.findMany({
    where: {
      status: "APPROVED",
      ...(userIds ? { userId: { in: userIds } } : {}),
      user: { deletedAt: null },
      pathway: { deletedAt: null, courses: { some: { courseId } } },
    },
    select: { userId: true, pathwayId: true, deadline: true },
  })
}

export type MarkResult = { marked: number; locked: number }

// Marks the session complete for a user in each of their enrollments that contain the
// course, then re-evaluates course completion there. `respectLock` skips enrollments
// locked by their deadline (learner check-in); admins and trainers pass false.
export async function markInPersonComplete(
  userId: string,
  content: { id: string; courseId: string },
  { method, markedById, respectLock }: { method: ContentCompletionMethod; markedById: string | null; respectLock: boolean }
): Promise<MarkResult> {
  const enrollments = await courseEnrollments(content.courseId, [userId])
  let marked = 0
  let locked = 0
  for (const e of enrollments) {
    if (respectLock && isDeadlineLocked(e.deadline)) {
      locked++
      continue
    }
    const key = { userId_contentId_pathwayId: { userId, contentId: content.id, pathwayId: e.pathwayId } }
    const existing = await prisma.contentProgress.findUnique({ where: key, select: { id: true } })
    // An existing completion keeps its original method and date.
    if (!existing) {
      await prisma.contentProgress.create({
        data: { userId, contentId: content.id, pathwayId: e.pathwayId, method, markedById },
      })
    }
    await evaluateCourseCompletion(userId, content.courseId, e.pathwayId)
    marked++
  }
  return { marked, locked }
}

// Removes the session's completion for a user in every pathway, and un-completes the
// course there so it's re-evaluated (as toggleContentComplete does).
export async function unmarkInPersonComplete(userId: string, content: { id: string; courseId: string }) {
  const removed = await prisma.contentProgress.findMany({
    where: { userId, contentId: content.id },
    select: { pathwayId: true },
  })
  if (removed.length === 0) return
  await prisma.contentProgress.deleteMany({ where: { userId, contentId: content.id } })
  await prisma.courseProgress.updateMany({
    where: { userId, courseId: content.courseId, pathwayId: { in: removed.map((r) => r.pathwayId) } },
    data: { completed: false, completedAt: null },
  })
}

// Check-in codes are short enough to type: 8 characters with no look-alikes
// (no 0/O, 1/I/L), shown as XXXX-XXXX. Stored without the dash.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function normalizeCheckInCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function formatCheckInCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

// The session's permanent check-in code, created the first time it's asked for.
export async function ensureCheckInCode(contentId: string): Promise<string> {
  const current = await prisma.content.findUnique({ where: { id: contentId }, select: { checkInCode: true } })
  if (current?.checkInCode) return current.checkInCode
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")
    // Only set it if still empty, so two admins opening the QR at once get the same code.
    const updated = await prisma.content.updateMany({ where: { id: contentId, checkInCode: null }, data: { checkInCode: code } }).catch(() => null)
    const now = await prisma.content.findUnique({ where: { id: contentId }, select: { checkInCode: true } })
    if (now?.checkInCode) return now.checkInCode
    if (updated === null) continue // code collision with another session: try another
  }
  throw new Error("Couldn't create a check-in code. Please try again.")
}
