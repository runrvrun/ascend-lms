import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { prisma } from "../../../../lib/prisma"
import { getUserReport } from "../../../../lib/userReport"
import { ProfessionalDetail } from "../../../../manager/professionals/[id]/ProfessionalDetail"
import { UserReportOverview } from "./UserReportOverview"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } })
  return { title: user?.name ? `${user.name} — Progress Report` : "User Progress Report" }
}

export default async function AdminUserProgressPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [report, growthPlanRecords] = await Promise.all([
    getUserReport(id),
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

  if (!report) notFound()

  const growthPlans = growthPlanRecords.map((g) => ({
    id: g.id,
    title: g.title,
    completedAt: g.completedAt ? g.completedAt.toISOString() : null,
    confirmedAt: g.confirmedAt ? g.confirmedAt.toISOString() : null,
    pathwayName: g.pathway?.name ?? null,
  }))

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <UserReportOverview report={report} />
      <Suspense>
        <ProfessionalDetail
          professional={{
            id: report.user.id,
            name: report.user.name,
            email: report.user.email,
            division: report.user.division,
            title: report.user.title,
            office: report.user.office,
          }}
          enrollments={report.enrollments}
          growthPlans={growthPlans}
          hideHeader
        />
      </Suspense>
    </main>
  )
}
