import type { Metadata } from "next"
export const metadata: Metadata = { title: "Dashboard" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { MyPathwaysCard } from "../components/MyPathwaysCard"
import { MyPointsCard } from "../components/MyPointsCard"
import { Leaderboard } from "../components/Leaderboard"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [enrollments, totalAgg, recentPoints, courseProgressRecords, pathwayCourseCounts, pointsGrouped, allContentProgress] = await Promise.all([
    prisma.pathwayEnrollment.findMany({
      where: { userId, status: { not: "REJECTED" } },
      include: {
        pathway: { select: { name: true, description: true } },
        cohort: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.userPoint.aggregate({
      where: { userId },
      _sum: { points: true },
    }),

    prisma.userPoint.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),

    // Completed courses per pathway for this user
    prisma.courseProgress.findMany({
      where: { userId, completed: true },
      select: { pathwayId: true },
    }),

    // Total published course count per pathway
    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true },
    }),

    // Points leaderboard: sum per user, top 10
    prisma.userPoint.groupBy({
      by: ["userId"],
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 10,
    }),

    // Streak leaderboard: all content progress to compute per-user streaks
    prisma.contentProgress.findMany({
      select: { userId: true, completedAt: true },
    }),
  ])

  // Build completion map: pathwayId → { completed, total }
  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }
  const totalByPathway: Record<string, number> = {}
  for (const pc of pathwayCourseCounts) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
  }

  const enrollmentsWithCompletion = enrollments.map((e) => {
    const total = totalByPathway[e.pathwayId] ?? 0
    const completed = completedByPathway[e.pathwayId] ?? 0
    return { ...e, isCompleted: total > 0 && completed >= total }
  })

  // Parse courseId:pathwayId from referenceId and resolve names in one batch
  const completionRefs = recentPoints
    .filter((p) => p.source === "COURSE_COMPLETION" && p.referenceId?.includes(":"))
    .map((p) => {
      const [courseId, pathwayId] = p.referenceId!.split(":")
      return { id: p.id, courseId, pathwayId }
    })

  const uniqueCourseIds = [...new Set(completionRefs.map((r) => r.courseId))]
  const uniquePathwayIds = [...new Set(completionRefs.map((r) => r.pathwayId))]

  const [courses, pathways] = await Promise.all([
    uniqueCourseIds.length
      ? prisma.course.findMany({ where: { id: { in: uniqueCourseIds } }, select: { id: true, name: true } })
      : [],
    uniquePathwayIds.length
      ? prisma.pathway.findMany({ where: { id: { in: uniquePathwayIds } }, select: { id: true, name: true } })
      : [],
  ])

  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.name]))
  const pathwayMap = Object.fromEntries(pathways.map((p) => [p.id, p.name]))
  const refMetaMap = Object.fromEntries(
    completionRefs.map((r) => [r.id, { courseName: courseMap[r.courseId] ?? null, pathwayName: pathwayMap[r.pathwayId] ?? null }])
  )

  const pointItems = recentPoints.map((p) => ({
    ...p,
    courseName: refMetaMap[p.id]?.courseName ?? null,
    pathwayName: refMetaMap[p.id]?.pathwayName ?? null,
  }))

  // ── Leaderboard data ──────────────────────────────────────────────────────

  // Points leaderboard: fetch user details for the top 10
  const pointsUserIds = pointsGrouped.map((r) => r.userId)
  const pointsUsers = await prisma.user.findMany({
    where: { id: { in: pointsUserIds } },
    select: { id: true, name: true, title: true, division: true, office: { select: { name: true } } },
  })
  const pointsUserMap = Object.fromEntries(pointsUsers.map((u) => [u.id, u]))
  const pointsRows = pointsGrouped.map((r) => {
    const u = pointsUserMap[r.userId]
    return {
      userId: r.userId,
      name: u?.name ?? null,
      title: u?.title ?? "",
      division: u?.division ?? "",
      office: u?.office?.name ?? null,
      value: r._sum.points ?? 0,
      isCurrentUser: r.userId === userId,
    }
  })

  // Streak leaderboard: compute streak per user, take top 10
  function computeStreak(dates: Date[]): number {
    if (dates.length === 0) return 0
    const daySet = new Set(dates.map((d) => { const dd = new Date(d); dd.setUTCHours(0,0,0,0); return dd.getTime() }))
    const sorted = Array.from(daySet).sort((a, b) => b - a)
    const todayMs = (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d.getTime() })()
    if (sorted[0] < todayMs - 86_400_000) return 0
    let streak = 0, expected = sorted[0]
    for (const day of sorted) {
      if (day === expected) { streak++; expected -= 86_400_000 } else break
    }
    return streak
  }

  const progressByUser: Record<string, Date[]> = {}
  for (const r of allContentProgress) {
    ;(progressByUser[r.userId] ??= []).push(r.completedAt)
  }
  const streakEntries = Object.entries(progressByUser)
    .map(([uid, dates]) => ({ userId: uid, streak: computeStreak(dates) }))
    .filter((e) => e.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 10)

  const streakUserIds = streakEntries.map((e) => e.userId)
  const streakUsers = await prisma.user.findMany({
    where: { id: { in: streakUserIds } },
    select: { id: true, name: true, title: true, division: true, office: { select: { name: true } } },
  })
  const streakUserMap = Object.fromEntries(streakUsers.map((u) => [u.id, u]))
  const streakRows = streakEntries.map((e) => {
    const u = streakUserMap[e.userId]
    return {
      userId: e.userId,
      name: u?.name ?? null,
      title: u?.title ?? "",
      division: u?.division ?? "",
      office: u?.office?.name ?? null,
      value: e.streak,
      isCurrentUser: e.userId === userId,
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Dashboard</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <MyPathwaysCard enrollments={enrollmentsWithCompletion} />
          <MyPointsCard total={totalAgg._sum.points ?? 0} recent={pointItems} />
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Leaderboards</h2>
          <Leaderboard pointsRows={pointsRows} streakRows={streakRows} />
        </div>
      </main>
    </div>
  )
}
