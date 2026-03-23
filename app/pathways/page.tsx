import type { Metadata } from "next"
export const metadata: Metadata = { title: "Pathways" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { PathwayList } from "./PathwayList"

export default async function PathwaysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [pathways, enrollments, courseProgressRecords, pathwayCourseCounts, currentUser, divisionEnrollments] = await Promise.all([
    prisma.pathway.findMany({
      where: { deletedAt: null, status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        description: true,
        requiresApproval: true,
        tags: true,
        _count: { select: { courses: true, pathwayEnrollments: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pathwayEnrollment.findMany({
      where: { userId },
      select: {
        pathwayId: true,
        status: true,
        note: true,
        rejectionReason: true,
      },
    }),
    prisma.courseProgress.findMany({
      where: { userId, completed: true },
      select: { pathwayId: true },
    }),
    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { division: true },
    }),
    prisma.pathwayEnrollment.findMany({
      where: { status: "APPROVED" },
      select: { pathwayId: true, user: { select: { division: true } } },
    }),
  ])

  const enrollmentMap = Object.fromEntries(enrollments.map((e) => [e.pathwayId, e]))

  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }

  const totalByPathway: Record<string, number> = {}
  for (const pc of pathwayCourseCounts) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
  }

  const pathwayCards = pathways.map((p) => {
    const total = totalByPathway[p.id] ?? 0
    const completed = completedByPathway[p.id] ?? 0
    const isApproved = enrollmentMap[p.id]?.status === "APPROVED"
    return {
      ...p,
      enrollment: enrollmentMap[p.id] ?? null,
      isCompleted: total > 0 && completed >= total && isApproved,
      completedCourses: isApproved ? completed : 0,
      totalCourses: isApproved ? total : 0,
      isRecommended: false,
    }
  })

  // Count approved enrollments per pathway scoped to the current user's division
  const userDivision = currentUser?.division
  const divisionEnrollmentCount: Record<string, number> = {}
  for (const e of divisionEnrollments) {
    if (e.user.division === userDivision) {
      divisionEnrollmentCount[e.pathwayId] = (divisionEnrollmentCount[e.pathwayId] ?? 0) + 1
    }
  }

  // Top 2 recommendations: unenrolled/uncompleted, ranked by same-division enrollment count
  const recommendedIds = new Set(
    pathwayCards
      .filter((p) => {
        const status = p.enrollment?.status
        return (!status || status === "REJECTED") && !p.isCompleted
      })
      .sort((a, b) => (divisionEnrollmentCount[b.id] ?? 0) - (divisionEnrollmentCount[a.id] ?? 0))
      .slice(0, 2)
      .map((p) => p.id)
  )

  const pathwayCardsWithRec = pathwayCards.map((p) => ({
    ...p,
    isRecommended: recommendedIds.has(p.id),
  }))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Pathways</h1>
          <p className="mt-1 text-sm text-slate-500">Browse and enroll in learning pathways</p>
        </div>

        <PathwayList pathways={pathwayCardsWithRec} />
      </main>
    </div>
  )
}
