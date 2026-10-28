import type { Metadata } from "next"
export const metadata: Metadata = { title: "Pathways" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { PathwayList } from "./PathwayList"
import { MAX_FEATURED_PATHWAYS } from "../lib/featuredPathways"
import { buildRecommendations, type Recommendation } from "../lib/pathwayRecommendations"

export default async function PathwaysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [pathways, enrollments, courseProgressRecords, pathwayCourseCounts, currentUser, allEnrollments, allCompletedCourses] = await Promise.all([
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
      select: { pathwayId: true, course: { select: { topicId: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { division: true },
    }),
    prisma.pathwayEnrollment.findMany({
      where: { status: "APPROVED" },
      select: { userId: true, pathwayId: true, type: true, cohortId: true, createdAt: true, user: { select: { division: true } } },
    }),
    prisma.courseProgress.groupBy({
      by: ["userId", "pathwayId"],
      where: { completed: true, course: { status: "PUBLISHED", deletedAt: null } },
      _count: { _all: true },
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
    }
  })

  // Admin-featured pathways take the recommendation slots first (shown to everyone,
  // oldest-featured first); any remaining slots go to automated picks.
  const featuredIds = pathwayCards
    .filter((p) => p.featuredAt)
    .sort((a, b) => a.featuredAt!.getTime() - b.featuredAt!.getTime())
    .slice(0, MAX_FEATURED_PATHWAYS)
    .map((p) => p.id)

  const pathwayFeatures: Record<string, Set<string>> = {}
  for (const p of pathways) pathwayFeatures[p.id] = new Set(p.tags.map((t) => `tag:${t.trim().toLowerCase()}`))
  for (const pc of pathwayCourseCounts) {
    if (pc.course.topicId) pathwayFeatures[pc.pathwayId]?.add(`topic:${pc.course.topicId}`)
  }

  const completedPairs = new Set(
    allCompletedCourses
      .filter((c) => (totalByPathway[c.pathwayId] ?? 0) > 0 && c._count._all >= totalByPathway[c.pathwayId])
      .map((c) => `${c.userId}:${c.pathwayId}`)
  )

  const automated = buildRecommendations({
    userId,
    userDivision: currentUser?.division ?? null,
    slots: MAX_FEATURED_PATHWAYS - featuredIds.length,
    eligibleIds: pathwayCards
      .filter((p) => {
        const status = p.enrollment?.status
        return !featuredIds.includes(p.id) && (!status || status === "REJECTED") && !p.isCompleted
      })
      .map((p) => p.id),
    pathwayNames: Object.fromEntries(pathways.map((p) => [p.id, p.name])),
    pathwayFeatures,
    myEnrolledIds: enrollments.filter((e) => e.status === "APPROVED").map((e) => e.pathwayId),
    myCompletedIds: pathwayCards.filter((p) => p.isCompleted).map((p) => p.id),
    completedPairs,
    enrollments: allEnrollments.map((e) => ({
      userId: e.userId,
      pathwayId: e.pathwayId,
      createdAt: e.createdAt,
      // Assigned or cohort enrollments are often mandatory training, not a choice
      voluntary: e.type !== "ASSIGNED" && !e.cohortId,
      division: e.user.division,
    })),
  })

  const recommendations: Record<string, Recommendation> = {}
  for (const id of featuredIds) recommendations[id] = { kind: "featured", label: "Featured" }
  for (const r of automated) recommendations[r.pathwayId] = r.recommendation
  const recommendedOrder = [...featuredIds, ...automated.map((r) => r.pathwayId)]

  const pathwayCardsWithRec = pathwayCards.map(({ featuredAt, ...p }) => ({
    ...p,
    recommendation: recommendations[p.id] ?? null,
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
