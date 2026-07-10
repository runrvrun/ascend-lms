import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { prisma } from "../../../../lib/prisma"
import { getUserLearningProgress } from "../../../../lib/userLearningProgress"
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
    },
  })

  if (!user) notFound()

  const [enrollments, growthPlanRecords] = await Promise.all([
    getUserLearningProgress(id),
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
