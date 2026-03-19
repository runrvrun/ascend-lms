import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { DashboardSidebar } from "../../components/DashboardSidebar"
import { PathwayViewer } from "./PathwayViewer"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const pathway = await prisma.pathway.findUnique({ where: { id }, select: { name: true } })
  return { title: pathway?.name ?? "Pathway" }
}

export default async function PathwayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [pathway, enrollment, completedRecords, courseProgressRecords] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null },
      include: {
        courses: {
          orderBy: { order: "asc" },
          include: {
            course: {
              include: {
                contents: {
                  where: { deletedAt: null },
                  orderBy: { order: "asc" },
                },
                test: {
                  where: { deletedAt: null },
                  include: {
                    questions: {
                      where: { deletedAt: null },
                      orderBy: { order: "asc" },
                      include: { options: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.pathwayEnrollment.findUnique({
      where: { userId_pathwayId: { userId, pathwayId: id } },
      select: { status: true },
    }),
    prisma.contentProgress.findMany({
      where: { userId, pathwayId: id },
      select: { contentId: true },
    }),
    prisma.courseProgress.findMany({
      where: { userId, pathwayId: id, completed: true },
      select: { courseId: true },
    }),
  ])

  if (!pathway) notFound()
  if (enrollment?.status !== "APPROVED") redirect("/pathways")

  const completedContentIds = new Set(completedRecords.map((r) => r.contentId))
  const completedCourseIds = new Set(courseProgressRecords.map((r) => r.courseId))
  const isPathwayComplete =
    pathway.courses.length > 0 &&
    pathway.courses.every((entry) => completedCourseIds.has(entry.course.id))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <DashboardSidebar session={session} />
      <PathwayViewer
        pathway={pathway}
        completedContentIds={completedContentIds}
        completedCourseIds={completedCourseIds}
        isPathwayComplete={isPathwayComplete}
      />
    </div>
  )
}
