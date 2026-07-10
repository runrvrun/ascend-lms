import type { Metadata } from "next"
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { getUserLearningProgress } from "../../../lib/userLearningProgress"
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
    },
  })

  if (!professional) notFound()

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
