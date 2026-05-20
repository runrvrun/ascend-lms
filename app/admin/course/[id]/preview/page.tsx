import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../../lib/prisma"
import { SidebarWithStats } from "../../../../components/SidebarWithStats"
import { PathwayViewer } from "../../../../pathways/[id]/PathwayViewer"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const course = await prisma.course.findUnique({ where: { id }, select: { name: true } })
  return { title: course ? `Preview: ${course.name}` : "Course Preview" }
}

export default async function CoursePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string

  const roles = await prisma.userRole.findMany({ where: { userId }, select: { role: true } })
  const isPrivileged = roles.some((r) => ["ADMIN", "TRAINER", "SME"].includes(r.role))
  if (!isPrivileged) redirect("/")

  const course = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      contents: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      test: {
        where: { deletedAt: null },
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
          test: course.test,
          assignment: course.assignment,
          feedbackEnabled: course.feedbackEnabled,
        },
      },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />
      <PathwayViewer
        pathway={syntheticPathway}
        completedContentIds={new Set()}
        completedCourseIds={new Set()}
        isPathwayComplete={false}
        currentUserId={userId}
        latestSubmissionByAssignmentId={{}}
        testStatusByCourseId={{}}
        assignmentStatusByCourseId={{}}
        feedbackByCourseId={{}}
        allGrowthPlans={[]}
        isPreview
        backHref={`/admin/course/${course.id}`}
        backLabel="Back to Course"
      />
    </div>
  )
}
