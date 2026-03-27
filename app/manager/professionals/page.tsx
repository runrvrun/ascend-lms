import type { Metadata } from "next"
export const metadata: Metadata = { title: "Professionals" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { ProfessionalsList } from "./ProfessionalsList"

export default async function ProfessionalsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const managerId = (session.user as any).id as string

  const [professionals, pathways, pathwayCourseCounts] = await Promise.all([
    prisma.user.findMany({
      where: { managers: { some: { managerId } } },
      select: {
        id: true,
        name: true,
        email: true,
        division: true,
        title: true,
        office: { select: { name: true } },
        enrollments: {
          where: { status: "APPROVED" },
          select: { pathwayId: true },
        },
        courseProgress: {
          where: { completed: true },
          select: { pathwayId: true },
        },
        points: {
          select: { points: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pathway.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true },
    }),
  ])

  const courseCountByPathway: Record<string, number> = {}
  for (const pc of pathwayCourseCounts) {
    courseCountByPathway[pc.pathwayId] = (courseCountByPathway[pc.pathwayId] ?? 0) + 1
  }

  const professionalsWithStats = professionals.map((p) => {
    const enrolledPathwayIds = p.enrollments.map((e) => e.pathwayId)

    // Count completed courses per pathway
    const completedCoursesByPathway: Record<string, number> = {}
    p.courseProgress.forEach((cp) => {
      completedCoursesByPathway[cp.pathwayId] = (completedCoursesByPathway[cp.pathwayId] ?? 0) + 1
    })

    const completedPathways = enrolledPathwayIds.filter((pid) => {
      const total = courseCountByPathway[pid] ?? 0
      const completed = completedCoursesByPathway[pid] ?? 0
      return total > 0 && completed >= total
    }).length

    const totalPoints = p.points.reduce((sum, pt) => sum + pt.points, 0)

    return {
      id: p.id,
      name: p.name,
      email: p.email,
      division: p.division,
      title: p.title,
      office: p.office?.name ?? null,
      enrolledPathwayIds,
      pathwayCount: enrolledPathwayIds.length,
      completedPathways,
      totalPoints,
    }
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Professionals</h1>
        <p className="mt-1 text-sm text-slate-500">
          {professionals.length} professional{professionals.length !== 1 ? "s" : ""} under your management
        </p>
      </div>
      <ProfessionalsList professionals={professionalsWithStats} pathways={pathways} />
    </main>
  )
}
