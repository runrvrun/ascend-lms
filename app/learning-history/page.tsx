import type { Metadata } from "next"
export const metadata: Metadata = { title: "Learning History" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { DashboardSidebar } from "../components/DashboardSidebar"
import { CheckCircle2, BookOpen, Map, Star } from "lucide-react"

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function LearningHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [courseProgressRecords, completedPathways, totalPoints] = await Promise.all([
    prisma.courseProgress.findMany({
      where: { userId, completed: true },
      include: {
        course: { select: { name: true } },
        pathway: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true },
    }),
    prisma.userPoint.aggregate({
      where: { userId },
      _sum: { points: true },
    }),
  ])

  // Group completed courses by pathway
  const byPathway: Record<string, { pathwayId: string; pathwayName: string; courses: typeof courseProgressRecords }> = {}
  for (const cp of courseProgressRecords) {
    if (!byPathway[cp.pathwayId]) {
      byPathway[cp.pathwayId] = { pathwayId: cp.pathwayId, pathwayName: cp.pathway.name, courses: [] }
    }
    byPathway[cp.pathwayId].courses.push(cp)
  }

  // Compute completed pathways: all PUBLISHED courses done
  const totalByPathway: Record<string, number> = {}
  for (const pc of completedPathways) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
  }
  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }
  const completedPathwayCount = Object.keys(byPathway).filter((pid) => {
    const total = totalByPathway[pid] ?? 0
    const done = completedByPathway[pid] ?? 0
    return total > 0 && done >= total
  }).length

  const groups = Object.values(byPathway)

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <DashboardSidebar session={session} />

      <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Learning History</h1>
          <p className="mt-1 text-sm text-slate-500">Your completed courses and achievements</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
              <BookOpen size={14} />
              Courses Completed
            </div>
            <p className="text-3xl font-black text-slate-900">{courseProgressRecords.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
              <Map size={14} />
              Pathways Completed
            </div>
            <p className="text-3xl font-black text-slate-900">{completedPathwayCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
              <Star size={14} className="text-yellow-500" />
              Total Points
            </div>
            <p className="text-3xl font-black text-slate-900">{(totalPoints._sum.points ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* History grouped by pathway */}
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-400">
            No courses completed yet. Start learning from your enrolled pathways!
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => {
              const total = totalByPathway[group.pathwayId] ?? 0
              const done = completedByPathway[group.pathwayId] ?? 0
              const isPathwayComplete = total > 0 && done >= total
              return (
                <div key={group.pathwayId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Map size={15} className="text-blue-500" />
                      <span className="font-semibold text-slate-800">{group.pathwayName}</span>
                    </div>
                    {isPathwayComplete ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle2 size={11} />
                        Pathway Completed
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{done}/{total} courses</span>
                    )}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.courses.map((cp) => (
                      <li key={cp.id} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={15} className="shrink-0 text-green-500" />
                          <span className="text-sm text-slate-700">{cp.course.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          {cp.score != null && (
                            <span className="text-xs font-medium text-slate-500">
                              Score: {Math.round(cp.score)}%
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {cp.completedAt ? formatDate(cp.completedAt) : "—"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
