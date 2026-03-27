import type { Metadata } from "next"
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { ProfessionalDetail } from "./ProfessionalDetail"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } })
  return { title: user?.name ? `${user.name} — Progress` : "Team Member Progress" }
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const managerId = (session.user as any).id as string
  const { id } = await params

  // Verify this professional is under the requesting manager
  const professional = await prisma.user.findFirst({
    where: { id, managers: { some: { managerId } } },
    select: {
      id: true,
      name: true,
      email: true,
      division: true,
      title: true,
      office: { select: { name: true } },
      enrollments: {
        where: { status: { not: "REJECTED" } },
        select: {
          id: true,
          pathwayId: true,
          type: true,
          status: true,
          deadline: true,
          pathway: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!professional) notFound()

  const [courseProgressRecords, pathwayCourseCounts, growthPlanRecords] = await Promise.all([
    prisma.courseProgress.findMany({
      where: { userId: id, completed: true },
      select: { pathwayId: true },
    }),
    prisma.pathwayCourse.groupBy({
      by: ["pathwayId"],
      _count: { courseId: true },
    }),
    prisma.growthPlan.findMany({
      where: { userId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        completedAt: true,
        confirmedAt: true,
        pathway: { select: { name: true } },
      },
    }),
  ])

  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }
  const totalByPathway = Object.fromEntries(
    pathwayCourseCounts.map((r) => [r.pathwayId, r._count.courseId])
  )

  const enrollments = professional.enrollments.map((e) => {
    const total = totalByPathway[e.pathwayId] ?? 0
    const completed = completedByPathway[e.pathwayId] ?? 0
    return {
      ...e,
      completedCourses: completed,
      totalCourses: total,
      isCompleted: total > 0 && completed >= total && e.status === "APPROVED",
      deadline: e.deadline ? e.deadline.toISOString() : null,
    }
  })

  const growthPlans = growthPlanRecords.map((g) => ({
    id: g.id,
    title: g.title,
    completedAt: g.completedAt ? g.completedAt.toISOString() : null,
    confirmedAt: g.confirmedAt ? g.confirmedAt.toISOString() : null,
    pathwayName: g.pathway?.name ?? null,
  }))

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <Suspense>
        <ProfessionalDetail
          professional={{
            id: professional.id,
            name: professional.name,
            email: professional.email,
            division: professional.division,
            title: professional.title,
            office: professional.office?.name ?? null,
          }}
          enrollments={enrollments}
          growthPlans={growthPlans}
        />
      </Suspense>
    </main>
  )
}
