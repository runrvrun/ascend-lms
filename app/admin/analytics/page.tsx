import type { Metadata } from "next"
export const metadata: Metadata = { title: "Analytics" }

import { prisma } from "../../lib/prisma"
import { BarChart3, Users, BookOpen, GraduationCap, TrendingUp, Star, Award, Briefcase } from "lucide-react"
import { AnalyticsFilter } from "../../components/AnalyticsFilter"
import { Prisma } from "@prisma/client"

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color = "blue",
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  color?: "blue" | "green" | "purple" | "amber"
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-xl p-2 ${colors[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color = "bg-blue-500" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="max-w-[72%] truncate font-medium text-slate-800">{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string; title?: string; officeId?: string }>
}) {
  const { division, title, officeId } = await searchParams

  const offices = await prisma.office.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const hasFilter = !!(division || title || officeId)

  const userWhere: Prisma.UserWhereInput = {
    deletedAt: null,
    status: "ACTIVE",
    ...(division ? { division: division as any } : {}),
    ...(title ? { title: title as any } : {}),
    ...(officeId ? { officeId } : {}),
  }

  // Only fetch filtered user IDs when a filter is active (avoids full table scan otherwise)
  let filteredUserIds: string[] | undefined
  if (hasFilter) {
    filteredUserIds = (
      await prisma.user.findMany({ where: userWhere, select: { id: true } })
    ).map((u) => u.id)
  }

  const enrollmentWhere: Prisma.PathwayEnrollmentWhereInput = {
    status: "APPROVED",
    ...(filteredUserIds ? { userId: { in: filteredUserIds } } : {}),
  }

  const [
    userCount,
    pathwayCount,
    enrollmentCount,
    enrollmentsRaw,
    progressRecords,
    courseCounts,
    enrollmentsByPathway,
    divisionStats,
    titleStats,
    earners,
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.pathway.count({ where: { deletedAt: null } }),
    prisma.pathwayEnrollment.count({ where: enrollmentWhere }),

    prisma.pathwayEnrollment.findMany({
      where: enrollmentWhere,
      select: { userId: true, pathwayId: true },
    }),
    prisma.courseProgress.findMany({
      where: { completed: true, ...(filteredUserIds ? { userId: { in: filteredUserIds } } : {}) },
      select: { userId: true, pathwayId: true },
    }),
    prisma.pathwayCourse.groupBy({ by: ["pathwayId"], _count: { courseId: true } }),

    // Top 8 pathways by enrollment among filtered users
    prisma.pathwayEnrollment.groupBy({
      by: ["pathwayId"],
      where: enrollmentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),

    // Division breakdown
    prisma.user.groupBy({
      by: ["division"],
      where: { ...userWhere, enrollments: { some: { status: "APPROVED" } } },
      _count: { id: true },
    }),

    // Title breakdown
    prisma.user.groupBy({
      by: ["title"],
      where: { ...userWhere, enrollments: { some: { status: "APPROVED" } } },
      _count: { id: true },
    }),

    // All filtered users with points (sorted in JS)
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        division: true,
        title: true,
        points: { select: { points: true } },
      },
    }),
  ])

  // Resolve pathway names for the top pathways groupBy result
  const topPathwayIds = enrollmentsByPathway.map((e) => e.pathwayId)
  const pathwayNames = await prisma.pathway.findMany({
    where: { id: { in: topPathwayIds } },
    select: { id: true, name: true },
  })
  const pathwayNameMap = Object.fromEntries(pathwayNames.map((p) => [p.id, p.name]))
  const topPathways = enrollmentsByPathway.map((e) => ({
    id: e.pathwayId,
    name: pathwayNameMap[e.pathwayId] ?? "Unknown",
    count: e._count.id,
  }))

  // Completion rate
  const completedPerUser: Record<string, Record<string, number>> = {}
  for (const cp of progressRecords) {
    if (!completedPerUser[cp.userId]) completedPerUser[cp.userId] = {}
    completedPerUser[cp.userId][cp.pathwayId] =
      (completedPerUser[cp.userId][cp.pathwayId] ?? 0) + 1
  }
  const totalByPathway = Object.fromEntries(courseCounts.map((r) => [r.pathwayId, r._count.courseId]))
  let completedEnrollments = 0
  for (const e of enrollmentsRaw) {
    const total = totalByPathway[e.pathwayId] ?? 0
    const done = completedPerUser[e.userId]?.[e.pathwayId] ?? 0
    if (total > 0 && done >= total) completedEnrollments++
  }
  const completionRate =
    enrollmentCount > 0 ? Math.round((completedEnrollments / enrollmentCount) * 100) : 0

  // Top earners
  const topEarners = earners
    .map((u) => ({ ...u, total: u.points.reduce((s, p) => s + p.points, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .filter((u) => u.total > 0)

  const maxEnrollments = Math.max(...topPathways.map((p) => p.count), 1)
  const maxDivision = Math.max(...divisionStats.map((d) => d._count.id), 1)
  const maxTitle = Math.max(...titleStats.map((t) => t._count.id), 1)

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Platform-wide learning metrics</p>
      </div>

      <div className="mb-6">
        <AnalyticsFilter
          offices={offices}
          current={{ division: division ?? "", title: title ?? "", officeId: officeId ?? "" }}
          basePath="/admin/analytics"
        />
      </div>

      {hasFilter && (
        <p className="mb-4 text-xs text-slate-400">
          Showing data for {userCount} user{userCount !== 1 ? "s" : ""} matching the selected filters.
        </p>
      )}

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={userCount} icon={Users} color="blue" />
        <StatCard label="Pathways" value={pathwayCount} icon={BookOpen} color="purple" />
        <StatCard label="Active Enrollments" value={enrollmentCount} icon={GraduationCap} color="green" />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={TrendingUp}
          color="amber"
          sub={`${completedEnrollments} of ${enrollmentCount} completed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top pathways */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">Top Pathways by Enrollment</h2>
          </div>
          {topPathways.length === 0 ? (
            <p className="text-sm text-slate-400">No enrollments match the current filter.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {topPathways.map((p) => (
                <BarRow key={p.id} label={p.name} value={p.count} max={maxEnrollments} color="bg-blue-500" />
              ))}
            </div>
          )}
        </div>

        {/* Division breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Enrolled Learners by Division</h2>
          </div>
          {divisionStats.length === 0 ? (
            <p className="text-sm text-slate-400">No data for the current filter.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[...divisionStats]
                .sort((a, b) => b._count.id - a._count.id)
                .map((d) => (
                  <BarRow key={d.division} label={d.division} value={d._count.id} max={maxDivision} color="bg-indigo-400" />
                ))}
            </div>
          )}
        </div>

        {/* Title breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Briefcase size={18} className="text-violet-600" />
            <h2 className="font-semibold text-slate-900">Enrolled Learners by Title</h2>
          </div>
          {titleStats.length === 0 ? (
            <p className="text-sm text-slate-400">No data for the current filter.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[...titleStats]
                .sort((a, b) => b._count.id - a._count.id)
                .map((t) => (
                  <BarRow key={t.title} label={formatEnum(t.title)} value={t._count.id} max={maxTitle} color="bg-violet-400" />
                ))}
            </div>
          )}
        </div>

        {/* Top point earners */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
            <Award size={18} className="text-yellow-500" />
            <h2 className="font-semibold text-slate-900">Top Point Earners</h2>
          </div>
          {topEarners.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No points awarded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {topEarners.map((u, i) => (
                <div key={u.id} className="flex items-center gap-4 px-6 py-3">
                  <span
                    className={`w-6 text-center text-sm font-bold ${
                      i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-slate-300"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{u.name ?? u.email}</p>
                    <p className="text-xs text-slate-400">{u.division} · {formatEnum(u.title)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star size={14} className="text-yellow-400" />
                    <span className="font-semibold text-slate-800">{u.total.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
