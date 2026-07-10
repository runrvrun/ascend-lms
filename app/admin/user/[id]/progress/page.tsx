import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { prisma } from "../../../../lib/prisma"
import { ProfessionalDetail } from "../../../../manager/professionals/[id]/ProfessionalDetail"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } })
  return { title: user?.name ? `${user.name} — Progress` : "User Progress" }
}

export default async function AdminUserProgressPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
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
          cohort: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!user) notFound()

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

  const enrollments = user.enrollments.map((e) => {
    const total = totalByPathway[e.pathwayId] ?? 0
    const completed = completedByPathway[e.pathwayId] ?? 0
    return {
      ...e,
      completedCourses: completed,
      totalCourses: total,
      isCompleted: total > 0 && completed >= total && e.status === "APPROVED",
      deadline: e.deadline ? e.deadline.toISOString() : null,
      cohortName: e.cohort?.name ?? null,
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
            id: user.id,
            name: user.name,
            email: user.email,
            division: user.division,
            title: user.title,
            office: user.office?.name ?? null,
          }}
          enrollments={enrollments}
          growthPlans={growthPlans}
          backHref="/admin/user"
          backLabel="Back to Users"
        />
      </Suspense>
    </main>
  )
}
