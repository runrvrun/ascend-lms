import type { Metadata } from "next"
export const metadata: Metadata = { title: "Pathways" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { PathwayList } from "./PathwayList"
import { MAX_FEATURED_PATHWAYS } from "../lib/featuredPathways"
import type { Recommendation } from "../lib/pathwayRecommendations"
import type { Language } from "@prisma/client"

export default async function PathwaysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [pathways, enrollments, courseProgressRecords, pathwayCourses, selfEnrollCounts] = await Promise.all([
    prisma.pathway.findMany({
      where: { deletedAt: null, status: "PUBLISHED", visibility: { not: "HIDDEN" } },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        tags: true,
        featuredAt: true,
        createdAt: true,
        _count: {
          select: {
            courses: true,
            pathwayEnrollments: { where: { status: { not: "REJECTED" } } },
          },
        },
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
      select: { pathwayId: true, course: { select: { language: true, topic: { select: { id: true, name: true } } } } },
    }),
    // Ranks the Topic filter: topics whose pathways people self-enroll in most come first.
    prisma.pathwayEnrollment.groupBy({
      by: ["pathwayId"],
      where: { type: "SELF_ENROLL" },
      _count: { _all: true },
    }),
  ])

  const enrollmentMap = Object.fromEntries(enrollments.map((e) => [e.pathwayId, e]))

  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }

  // A pathway's topics and languages are those of its published courses.
  const totalByPathway: Record<string, number> = {}
  const topicsByPathway: Record<string, Map<string, string>> = {}
  const languagesByPathway: Record<string, Set<Language>> = {}
  for (const pc of pathwayCourses) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
    ;(languagesByPathway[pc.pathwayId] ??= new Set()).add(pc.course.language)
    if (pc.course.topic) (topicsByPathway[pc.pathwayId] ??= new Map()).set(pc.course.topic.id, pc.course.topic.name)
  }
  const selfEnrollByPathway = Object.fromEntries(selfEnrollCounts.map((r) => [r.pathwayId, r._count._all]))

  const pathwayCards = pathways.map((p) => {
    const total = totalByPathway[p.id] ?? 0
    const completed = completedByPathway[p.id] ?? 0
    const isApproved = enrollmentMap[p.id]?.status === "APPROVED"
    const { createdAt, _count, ...rest } = p
    return {
      ...rest,
      _count: { courses: _count.courses },
      createdAt: createdAt.toISOString(),
      enrollmentCount: _count.pathwayEnrollments,
      topicIds: [...(topicsByPathway[p.id]?.keys() ?? [])],
      languages: [...(languagesByPathway[p.id] ?? [])],
      enrollment: enrollmentMap[p.id] ?? null,
      isCompleted: total > 0 && completed >= total && isApproved,
      completedCourses: isApproved ? completed : 0,
      totalCourses: isApproved ? total : 0,
    }
  })

  // Automated recommendations (buildRecommendations in app/lib/pathwayRecommendations.ts)
  // are switched off at HR's request: the admin-featured pathways are badged "Featured"
  // for everyone (enrolled or not) and, with the default sort, lead the list oldest-featured first.
  const featuredIds = pathwayCards
    .filter((p) => p.featuredAt)
    .sort((a, b) => a.featuredAt!.getTime() - b.featuredAt!.getTime())
    .slice(0, MAX_FEATURED_PATHWAYS)
    .map((p) => p.id)

  const recommendations: Record<string, Recommendation> = {}
  for (const id of featuredIds) recommendations[id] = { kind: "featured", label: "Featured" }
  const recommendedOrder = featuredIds

  // Topic filter options: every topic used by a listed pathway, with its pathway count,
  // most self-enrolled first (ties: more pathways, then name).
  const topicStats = new Map<string, { id: string; name: string; count: number; selfEnrolls: number }>()
  for (const p of pathways) {
    for (const [id, name] of topicsByPathway[p.id] ?? []) {
      const t = topicStats.get(id) ?? { id, name, count: 0, selfEnrolls: 0 }
      t.count++
      t.selfEnrolls += selfEnrollByPathway[p.id] ?? 0
      topicStats.set(id, t)
    }
  }
  const topics = [...topicStats.values()]
    .sort((a, b) => b.selfEnrolls - a.selfEnrolls || b.count - a.count || a.name.localeCompare(b.name))
    .map(({ id, name, count }) => ({ id, name, count }))

  const pathwayCardsWithRec = pathwayCards.map(({ featuredAt, ...p }) => ({
    ...p,
    recommendation: recommendations[p.id] ?? null,
  }))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-7xl p-6 md:p-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Pathways</h1>
        </div>

        <PathwayList pathways={pathwayCardsWithRec} recommendedOrder={recommendedOrder} topics={topics} />
      </main>
    </div>
  )
}
