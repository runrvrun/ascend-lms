import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { SidebarWithStats } from "../../components/SidebarWithStats"
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

  const [pathway, enrollment, completedRecords, courseProgressRecords, assignmentSubmissions, courseFeedbacks, allGrowthPlanRecords] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null, status: "PUBLISHED" },
      include: {
        courses: {
          where: { course: { status: "PUBLISHED", deletedAt: null } },
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
                assignment: {
                  where: { deletedAt: null },
                  select: { id: true, description: true, submitUrl: true },
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
      where: { userId, pathwayId: id },
      select: { courseId: true, completed: true, testStatus: true, assignmentStatus: true },
    }),
    prisma.assignmentSubmission.findMany({
      where: { userId, pathwayId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        assignmentId: true,
        submissionUrl: true,
        grade: true,
        status: true,
        adminNote: true,
        createdAt: true,
      },
    }),
    prisma.courseFeedback.findMany({
      where: { userId, pathwayId: id },
      select: { courseId: true, rating: true, comment: true },
    }),
    prisma.growthPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        completedAt: true,
        confirmedAt: true,
        pathwayId: true,
        pathway: { select: { name: true } },
      },
    }),
  ])

  if (!pathway) notFound()
  if (enrollment?.status !== "APPROVED") redirect("/pathways")

  const completedContentIds = new Set(completedRecords.map((r) => r.contentId))
  const completedCourseIds = new Set(courseProgressRecords.filter((r) => r.completed).map((r) => r.courseId))
  const testStatusByCourseId: Record<string, "PASSED" | "FAILED"> = {}
  const assignmentStatusByCourseId: Record<string, "PASSED" | "FAILED"> = {}
  for (const r of courseProgressRecords) {
    if (r.testStatus) testStatusByCourseId[r.courseId] = r.testStatus
    if (r.assignmentStatus) assignmentStatusByCourseId[r.courseId] = r.assignmentStatus
  }
  const isPathwayComplete =
    pathway.courses.length > 0 &&
    pathway.courses.every((entry) => completedCourseIds.has(entry.course.id))

  // Latest submission per assignment for this user+pathway
  const latestSubmissionByAssignmentId: Record<string, typeof assignmentSubmissions[0]> = {}
  for (const sub of assignmentSubmissions) {
    if (!latestSubmissionByAssignmentId[sub.assignmentId]) {
      latestSubmissionByAssignmentId[sub.assignmentId] = sub
    }
  }

  const feedbackByCourseId: Record<string, { rating: number; comment: string | null }> = {}
  for (const f of courseFeedbacks) {
    feedbackByCourseId[f.courseId] = { rating: f.rating, comment: f.comment }
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />
      <PathwayViewer
        pathway={pathway}
        completedContentIds={completedContentIds}
        completedCourseIds={completedCourseIds}
        isPathwayComplete={isPathwayComplete}
        currentUserId={userId}
        latestSubmissionByAssignmentId={latestSubmissionByAssignmentId}
        testStatusByCourseId={testStatusByCourseId}
        assignmentStatusByCourseId={assignmentStatusByCourseId}
        feedbackByCourseId={feedbackByCourseId}
        allGrowthPlans={allGrowthPlanRecords.map((g) => ({
          id: g.id,
          title: g.title,
          completedAt: g.completedAt,
          confirmedAt: g.confirmedAt,
          pathwayId: g.pathwayId,
          pathwayName: g.pathway?.name ?? null,
        }))}
      />
    </div>
  )
}
