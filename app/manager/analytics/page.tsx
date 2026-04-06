import type { Metadata } from "next"
export const metadata: Metadata = { title: "Team Analytics" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { BarChart3, Users, GraduationCap, TrendingUp, Star, Award, Briefcase } from "lucide-react"
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

function BarRow({
  label,
  value,
  max,
  sub,
  color = "bg-blue-500",
}: {
  label: string
  value: number
  max: number
  sub?: string
  color?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="max-w-[65%] truncate font-medium text-slate-800">{label}</span>
        <div className="flex items-center gap-2 text-slate-500">
          {sub && <span className="text-xs text-slate-400">{sub}</span>}
          <span>{value}</span>
        </div>
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

export default async function ManagerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string; title?: string; officeId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const managerId = (session.user as any).id as string
  const { division, title, officeId } = await searchParams

  const offices = await prisma.office.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const hasFilter = !!(division || title || officeId)

  // Base filter = team members of this manager
  const userWhere: Prisma.UserWhereInput = {
    managers: { some: { managerId } },
    deletedAt: null,
    ...(division ? { division: division as any } : {}),
    ...(title ? { title: title as any } : {}),
    ...(officeId ? { officeId } : {}),
  }

  // Fetch team members matching filter
  const teamMembers = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      division: true,
      title: true,
      points: { select: { points: true } },
    },
  })

  const teamIds = teamMembers.map((u) => u.id)

  if (teamIds.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Team Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Learning metrics for your team</p>
        </div>
        <div className="mb-6">
          <AnalyticsFilter
            offices={offices}
            current={{ division: division ?? "", title: title ?? "", officeId: officeId ?? "" }}
            basePath="/manager/analytics"
          />
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          {hasFilter ? "No team members match the selected filters." : "No team members assigned yet."}
        </div>
      </main>
    )
  }

  const enrollmentWhere: Prisma.PathwayEnrollmentWhereInput = {
    status: "APPROVED",
    userId: { in: teamIds },
  }

  const [
    enrollmentCount,
    enrollmentsRaw,
    progressRecords,
    courseCounts,
    enrollmentsByPathway,
    divisionStats,
    titleStats,
  ] = await Promise.all([
    prisma.pathwayEnrollment.count({ where: enrollmentWhere }),

    prisma.pathwayEnrollment.findMany({
      where: enrollmentWhere,
      select: { userId: true, pathwayId: true },
    }),

    prisma.courseProgress.findMany({
      where: { completed: true, userId: { in: teamIds } },
      select: { userId: true, pathwayId: true },
    }),

    prisma.pathwayCourse.groupBy({ by: ["pathwayId"], _count: { courseId: true } }),

    // Top pathways for this team
    prisma.pathwayEnrollment.groupBy({
      by: ["pathwayId"],
      where: enrollmentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),

    // Division breakdown within team
    prisma.user.groupBy({
      by: ["division"],
      where: { ...userWhere, enrollments: { some: { status: "APPROVED" } } },
      _count: { id: true },
    }),

    // Title breakdown within team
    prisma.user.groupBy({
      by: ["title"],
      where: { ...userWhere, enrollments: { some: { status: "APPROVED" } } },
      _count: { id: true },
    }),
  ])

  // Compute completion per (user, pathway)
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

  // Per-pathway: enrolled + completed count for the team
  const topPathwayIds = enrollmentsByPathway.map((e) => e.pathwayId)
  const pathwayNames = await prisma.pathway.findMany({
    where: { id: { in: topPathwayIds } },
    select: { id: true, name: true },
  })
  const pathwayNameMap = Object.fromEntries(pathwayNames.map((p) => [p.id, p.name]))

  const topPathways = enrollmentsByPathway.map((e) => {
    const enrolled = e._count.id
    // Count how many team members completed this pathway
    let completed = 0
    for (const userId of teamIds) {
      const total = totalByPathway[e.pathwayId] ?? 0
      const done = completedPerUser[userId]?.[e.pathwayId] ?? 0
      if (total > 0 && done >= total) completed++
    }
    return { id: e.pathwayId, name: pathwayNameMap[e.pathwayId] ?? "Unknown", enrolled, completed }
  })

  // Team leaderboard
  const totalPoints = teamMembers.reduce((s, u) => s + u.points.reduce((a, p) => a + p.points, 0), 0)
  const avgPoints = teamMembers.length > 0 ? Math.round(totalPoints / teamMembers.length) : 0

  const leaderboard = teamMembers
    .map((u) => ({ ...u, total: u.points.reduce((s, p) => s + p.points, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const maxEnrolled = Math.max(...topPathways.map((p) => p.enrolled), 1)
  const maxDivision = Math.max(...divisionStats.map((d) => d._count.id), 1)
  const maxTitle = Math.max(...titleStats.map((t) => t._count.id), 1)

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Team Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Learning metrics for your team</p>
      </div>

      <div className="mb-6">
        <AnalyticsFilter
          offices={offices}
          current={{ division: division ?? "", title: title ?? "", officeId: officeId ?? "" }}
          basePath="/manager/analytics"
        />
      </div>

      {hasFilter && (
        <p className="mb-4 text-xs text-slate-400">
          Showing data for {teamIds.length} team member{teamIds.length !== 1 ? "s" : ""} matching the selected filters.
        </p>
      )}

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Team Members" value={teamIds.length} icon={Users} color="blue" />
        <StatCard label="Active Enrollments" value={enrollmentCount} icon={GraduationCap} color="green" />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={TrendingUp}
          color="amber"
          sub={`${completedEnrollments} of ${enrollmentCount} completed`}
        />
        <StatCard
          label="Avg Points / Member"
          value={avgPoints.toLocaleString()}
          icon={Star}
          color="purple"
          sub={`${totalPoints.toLocaleString()} total points`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pathway progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">Team Pathway Progress</h2>
            <span className="ml-auto text-xs text-slate-400">enrolled · completed</span>
          </div>
          {topPathways.length === 0 ? (
            <p className="text-sm text-slate-400">No enrollments yet.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {topPathways.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-100 p-4">
                  <p className="mb-3 truncate font-medium text-slate-900">{p.name}</p>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Enrolled</span>
                        <span>{p.enrolled}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${Math.round((p.enrolled / maxEnrolled) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Completed</span>
                        <span>{p.completed} / {p.enrolled}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-green-500"
                          style={{ width: p.enrolled > 0 ? `${Math.round((p.completed / p.enrolled) * 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Division breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Team by Division</h2>
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
            <h2 className="font-semibold text-slate-900">Team by Title</h2>
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

        {/* Team leaderboard */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
            <Award size={18} className="text-yellow-500" />
            <h2 className="font-semibold text-slate-900">Team Leaderboard</h2>
          </div>
          {leaderboard.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No team members yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaderboard.map((u, i) => (
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
