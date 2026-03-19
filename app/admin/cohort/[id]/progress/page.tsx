import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Map, CheckCircle2, Users } from "lucide-react"
import { prisma } from "../../../../lib/prisma"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const cohort = await prisma.cohort.findUnique({ where: { id }, select: { name: true } })
  return { title: cohort ? `${cohort.name} — Progress` : "Cohort Progress" }
}

export default async function CohortProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [cohort, pathwayCourseCounts, allCourseProgress] = await Promise.all([
    prisma.cohort.findFirst({
      where: { id, deletedAt: null },
      include: {
        users: { select: { userId: true } },
        pathways: {
          include: {
            pathway: {
              select: { id: true, name: true, status: true, deletedAt: true },
            },
          },
        },
        enrollments: {
          where: { status: "APPROVED" },
          select: { userId: true, pathwayId: true },
        },
      },
    }),

    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true },
    }),

    prisma.courseProgress.findMany({
      where: { completed: true },
      select: { userId: true, pathwayId: true },
    }),
  ])

  if (!cohort) notFound()

  const memberIds = new Set(cohort.users.map((u) => u.userId))
  const memberCount = memberIds.size

  // Total published courses per pathway
  const totalByPathway: Record<string, number> = {}
  for (const pc of pathwayCourseCounts) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
  }

  // Completed courses per user per pathway
  const completedMap: Record<string, number> = {}
  for (const cp of allCourseProgress) {
    const key = `${cp.userId}:${cp.pathwayId}`
    completedMap[key] = (completedMap[key] ?? 0) + 1
  }

  // Only include PUBLISHED, non-deleted pathways
  const pathwayRows = cohort.pathways
    .filter((cp) => cp.pathway.status === "PUBLISHED" && !cp.pathway.deletedAt)
    .map(({ pathway: p }) => {
      const enrolledUsers = cohort.enrollments
        .filter((e) => e.pathwayId === p.id && memberIds.has(e.userId))
        .map((e) => e.userId)
      const enrolledCount = enrolledUsers.length

      const total = totalByPathway[p.id] ?? 0
      const completedCount = enrolledUsers.filter((uid) => {
        const done = completedMap[`${uid}:${p.id}`] ?? 0
        return total > 0 && done >= total
      }).length

      const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0

      return { pathway: p, enrolledCount, completedCount, completionRate }
    })

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <a href="/admin/cohort" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Back to Cohorts
      </a>

      <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cohort.name} — Progress</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Users size={14} />
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </div>
        </div>
        <a
          href={`/admin/cohort/${id}`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Manage Members
        </a>
      </div>

      {pathwayRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
          No published pathways assigned to this cohort yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Pathway</th>
                <th className="px-6 py-3 text-center">Enrolled</th>
                <th className="px-6 py-3 text-center">Completed</th>
                <th className="px-6 py-3 text-center">Rate</th>
                <th className="px-6 py-3">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pathwayRows.map(({ pathway, enrolledCount, completedCount, completionRate }) => (
                <tr key={pathway.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Map size={14} className="shrink-0 text-blue-400" />
                      <span className="font-medium text-slate-800">{pathway.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{enrolledCount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`flex items-center justify-center gap-1 ${completedCount > 0 ? "font-medium text-green-600" : "text-slate-400"}`}>
                      {completedCount > 0 && <CheckCircle2 size={13} />}
                      {completedCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      completionRate >= 80 ? "bg-green-100 text-green-700" :
                      completionRate >= 50 ? "bg-amber-100 text-amber-700" :
                      completionRate > 0  ? "bg-red-100 text-red-600" :
                      "bg-slate-100 text-slate-400"
                    }`}>
                      {enrolledCount === 0 ? "—" : `${completionRate}%`}
                    </span>
                  </td>
                  <td className="px-6 py-4 w-44">
                    {enrolledCount > 0 && (
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full transition-all ${completionRate >= 80 ? "bg-green-500" : completionRate >= 50 ? "bg-amber-400" : "bg-blue-500"}`}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
