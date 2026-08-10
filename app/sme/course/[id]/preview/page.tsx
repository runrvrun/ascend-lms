import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../../lib/prisma"
import { PathwayViewer } from "../../../../pathways/[id]/PathwayViewer"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const course = await prisma.course.findUnique({ where: { id }, select: { name: true } })
  return { title: course ? `Preview: ${course.name}` : "Course Preview" }
}

export default async function SmeCoursePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string
  const roles = ((session.user as any).roles as string[]) ?? []

  // SMEs can preview any course in their topics; admins bypass
  if (!roles.includes("ADMIN")) {
    const topicCheck = await prisma.course.findUnique({ where: { id }, select: { topicId: true } })
    if (!topicCheck?.topicId) redirect("/sme/course")
    const isSME = await prisma.topicSME.findUnique({
      where: { topicId_userId: { topicId: topicCheck.topicId, userId } },
    })
    if (!isSME) redirect("/sme/course")
  }

  const course = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      contents: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          popQuizzes: {
            where: { deletedAt: null },
            orderBy: { time: "asc" },
            select: {
              id: true,
              time: true,
              question: true,
              options: { orderBy: { order: "asc" }, select: { id: true, text: true } },
            },
          },
        },
      },
      tests: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          questions: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
      assignment: {
        where: { deletedAt: null },
        select: { id: true, description: true, submitUrl: true },
      },
    },
  })

  if (!course) notFound()

  // Build a synthetic single-course pathway for the viewer
  const syntheticPathway = {
    id: course.id,
    name: course.name,
    description: course.description,
    courses: [
      {
        order: 1,
        course: {
          id: course.id,
          name: course.name,
          contents: course.contents,
          tests: course.tests.map((t) => ({ ...t, order: t.order! })),
          assignment: course.assignment,
          feedbackEnabled: course.feedbackEnabled,
        },
      },
    ],
  }

  return (
    <PathwayViewer
      pathway={syntheticPathway}
      completedContentIds={new Set()}
      completedCourseIds={new Set()}
      isPathwayComplete={false}
      currentUserId={userId}
      latestSubmissionByAssignmentId={{}}
      testStatusByTestId={{}}
      assignmentStatusByCourseId={{}}
      feedbackByCourseId={{}}
      allGrowthPlans={[]}
      isPreview
      backHref={`/sme/course/${course.id}`}
      backLabel="Back to Course"
    />
  )
}
