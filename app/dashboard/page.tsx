import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { DashboardSidebar } from "../components/DashboardSidebar"
import { MyPathwaysCard } from "../components/MyPathwaysCard"
import { MyPointsCard } from "../components/MyPointsCard"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [enrollments, totalAgg, recentPoints] = await Promise.all([
    prisma.pathwayEnrollment.findMany({
      where: { userId, status: { not: "REJECTED" } },
      include: {
        pathway: { select: { name: true, description: true } },
        cohort: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.userPoint.aggregate({
      where: { userId },
      _sum: { points: true },
    }),

    prisma.userPoint.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  // Parse courseId:pathwayId from referenceId and resolve names in one batch
  const completionRefs = recentPoints
    .filter((p) => p.source === "COURSE_COMPLETION" && p.referenceId?.includes(":"))
    .map((p) => {
      const [courseId, pathwayId] = p.referenceId!.split(":")
      return { id: p.id, courseId, pathwayId }
    })

  const uniqueCourseIds = [...new Set(completionRefs.map((r) => r.courseId))]
  const uniquePathwayIds = [...new Set(completionRefs.map((r) => r.pathwayId))]

  const [courses, pathways] = await Promise.all([
    uniqueCourseIds.length
      ? prisma.course.findMany({ where: { id: { in: uniqueCourseIds } }, select: { id: true, name: true } })
      : [],
    uniquePathwayIds.length
      ? prisma.pathway.findMany({ where: { id: { in: uniquePathwayIds } }, select: { id: true, name: true } })
      : [],
  ])

  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.name]))
  const pathwayMap = Object.fromEntries(pathways.map((p) => [p.id, p.name]))
  const refMetaMap = Object.fromEntries(
    completionRefs.map((r) => [r.id, { courseName: courseMap[r.courseId] ?? null, pathwayName: pathwayMap[r.pathwayId] ?? null }])
  )

  const pointItems = recentPoints.map((p) => ({
    ...p,
    courseName: refMetaMap[p.id]?.courseName ?? null,
    pathwayName: refMetaMap[p.id]?.pathwayName ?? null,
  }))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <DashboardSidebar session={session} />

      <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Dashboard</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <MyPathwaysCard enrollments={enrollments} />
          <MyPointsCard total={totalAgg._sum.points ?? 0} recent={pointItems} />
        </div>
      </main>
    </div>
  )
}
