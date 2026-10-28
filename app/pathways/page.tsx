import type { Metadata } from "next"
export const metadata: Metadata = { title: "Pathways" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { PathwayList } from "./PathwayList"
import { MAX_FEATURED_PATHWAYS } from "../lib/featuredPathways"

export default async function PathwaysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [pathways, enrollments, courseProgressRecords, pathwayCourseCounts, currentUser, divisionEnrollments] = await Promise.all([
    prisma.pathway.findMany({
      where: { deletedAt: null, status: "PUBLISHED", visibility: { not: "HIDDEN" } },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        tags: true,
        featuredAt: true,
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
      isFeatured: false,
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

  // Admin-featured pathways take the recommendation slots first (shown to everyone,
  // oldest-featured first); any remaining slots go to automated picks:
  // unenrolled/uncompleted, ranked by same-division enrollment count.
  const featuredIds = pathwayCards
    .filter((p) => p.featuredAt)
    .sort((a, b) => a.featuredAt!.getTime() - b.featuredAt!.getTime())
    .slice(0, MAX_FEATURED_PATHWAYS)
    .map((p) => p.id)
  const automatedIds = pathwayCards
    .filter((p) => {
      const status = p.enrollment?.status
      return !featuredIds.includes(p.id) && (!status || status === "REJECTED") && !p.isCompleted
    })
    .sort((a, b) => (divisionEnrollmentCount[b.id] ?? 0) - (divisionEnrollmentCount[a.id] ?? 0))
    .slice(0, MAX_FEATURED_PATHWAYS - featuredIds.length)
    .map((p) => p.id)
  const recommendedOrder = [...featuredIds, ...automatedIds]

  const pathwayCardsWithRec = pathwayCards
    .map(({ featuredAt, ...p }) => ({
      ...p,
      isRecommended: recommendedOrder.includes(p.id),
      isFeatured: !!featuredAt && featuredIds.includes(p.id),
    }))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Pathways</h1>
          <p className="mt-1 text-sm text-slate-500">Browse and enroll in learning pathways</p>
        </div>

        <PathwayList pathways={pathwayCardsWithRec} recommendedOrder={recommendedOrder} />
      </main>
    </div>
  )
}
