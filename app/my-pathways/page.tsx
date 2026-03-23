import type { Metadata } from "next"
export const metadata: Metadata = { title: "My Pathways" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { MyPathwaysList } from "./MyPathwaysList"
import { ArrowLeft } from "lucide-react"

export default async function MyPathwaysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [enrollments, courseProgressRecords, pathwayCourseCounts] = await Promise.all([
    prisma.pathwayEnrollment.findMany({
      where: { userId, status: { not: "REJECTED" } },
      include: {
        pathway: { select: { name: true, description: true } },
        cohort: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courseProgress.findMany({
      where: { userId, completed: true },
      select: { pathwayId: true },
    }),
    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true },
    }),
  ])

  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }
  const totalByPathway: Record<string, number> = {}
  for (const pc of pathwayCourseCounts) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
  }

  const items = enrollments.map((e) => {
    const total = totalByPathway[e.pathwayId] ?? 0
    const completed = completedByPathway[e.pathwayId] ?? 0
    return { ...e, isCompleted: total > 0 && completed >= total }
  })

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-3xl p-6 md:p-10">
        <a href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} />
          Back to Dashboard
        </a>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Pathways</h1>
            <p className="mt-1 text-sm text-slate-500">{items.length} pathway{items.length !== 1 ? "s" : ""} enrolled</p>
          </div>
        </div>

        <MyPathwaysList enrollments={items} />
      </main>
    </div>
  )
}
