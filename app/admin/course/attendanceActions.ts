"use server"

// Attendance and check-in QR for in-person sessions — admins and the course's trainers
// (see app/lib/inPersonAttendance.ts). Marking ignores deadline locks.
import { revalidatePath } from "next/cache"
import type { ContentCompletionMethod } from "@prisma/client"
import { prisma } from "../../lib/prisma"
import {
  courseEnrollments,
  ensureCheckInCode,
  formatCheckInCode,
  markInPersonComplete,
  requireAttendanceManager,
  unmarkInPersonComplete,
} from "../../lib/inPersonAttendance"

export type AttendanceRow = {
  userId: string
  name: string | null
  email: string | null
  pathways: string[]
  // Null = not completed. Otherwise how and when (earliest across their pathways).
  method: ContentCompletionMethod | null
  completedAt: Date | null
}

function revalidateAttendance() {
  revalidatePath("/pathways/[id]", "page")
  revalidatePath("/dashboard")
}

// Everyone who can take this session: active users enrolled (approved) in a live
// pathway containing the course.
export async function getAttendance(contentId: string): Promise<AttendanceRow[]> {
  const { content } = await requireAttendanceManager(contentId)
  const enrollments = await courseEnrollments(content.courseId)
  const userIds = [...new Set(enrollments.map((e) => e.userId))]
  const [users, pathways, progress] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.pathway.findMany({ where: { id: { in: [...new Set(enrollments.map((e) => e.pathwayId))] } }, select: { id: true, name: true } }),
    prisma.contentProgress.findMany({
      where: { contentId, userId: { in: userIds } },
      select: { userId: true, method: true, completedAt: true },
      orderBy: { completedAt: "asc" },
    }),
  ])
  const pathwayName = new Map(pathways.map((p) => [p.id, p.name]))
  const firstProgress = new Map<string, { method: ContentCompletionMethod; completedAt: Date }>()
  for (const p of progress) if (!firstProgress.has(p.userId)) firstProgress.set(p.userId, p)
  return users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      pathways: enrollments.filter((e) => e.userId === u.id).map((e) => pathwayName.get(e.pathwayId) ?? ""),
      method: firstProgress.get(u.id)?.method ?? null,
      completedAt: firstProgress.get(u.id)?.completedAt ?? null,
    }))
    .sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""))
}

export async function setAttendance(contentId: string, userIds: string[], attended: boolean) {
  const { user, content } = await requireAttendanceManager(contentId)
  // Only people enrolled in a pathway with this course can be marked.
  const allowed = new Set((await courseEnrollments(content.courseId, userIds)).map((e) => e.userId))
  for (const userId of userIds) {
    if (!allowed.has(userId)) continue
    if (attended) await markInPersonComplete(userId, content, { method: "ADMIN", markedById: user.id, respectLock: false })
    else await unmarkInPersonComplete(userId, content)
  }
  revalidateAttendance()
}

export type EmailAttendanceResult = { marked: number; alreadyMarked: number; notEnrolled: string[]; notFound: string[] }

// Marks everyone in a pasted list of emails (e.g. copied from a Teams attendance
// report). Any text works: email addresses are picked out of it.
export async function markAttendanceByEmails(contentId: string, text: string): Promise<EmailAttendanceResult> {
  const { user, content } = await requireAttendanceManager(contentId)
  const emails = [...new Set((text.match(/[^\s,;<>()"']+@[^\s,;<>()"']+\.[^\s,;<>()"']+/g) ?? []).map((e) => e.toLowerCase()))]
  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" }, deletedAt: null },
    select: { id: true, email: true },
  })
  const userByEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u.id]))
  const enrolled = new Set((await courseEnrollments(content.courseId, users.map((u) => u.id))).map((e) => e.userId))
  const done = new Set(
    (await prisma.contentProgress.findMany({ where: { contentId, userId: { in: users.map((u) => u.id) } }, select: { userId: true } })).map((p) => p.userId)
  )

  const result: EmailAttendanceResult = { marked: 0, alreadyMarked: 0, notEnrolled: [], notFound: [] }
  for (const email of emails) {
    const userId = userByEmail.get(email)
    if (!userId) result.notFound.push(email)
    else if (!enrolled.has(userId)) result.notEnrolled.push(email)
    else if (done.has(userId)) result.alreadyMarked++
    else {
      await markInPersonComplete(userId, content, { method: "ADMIN", markedById: user.id, respectLock: false })
      done.add(userId)
      result.marked++
    }
  }
  revalidateAttendance()
  return result
}

export async function getCheckInCode(contentId: string): Promise<string> {
  await requireAttendanceManager(contentId)
  return formatCheckInCode(await ensureCheckInCode(contentId))
}
