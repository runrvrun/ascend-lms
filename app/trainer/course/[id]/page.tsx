import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { ContentManagement } from "../../../admin/course/[id]/ContentManagement"
import { PopQuizManagement } from "../../../admin/course/[id]/PopQuizManagement"
import { TestManagement } from "../../../admin/course/[id]/TestManagement"
import { AssignmentManagement, SubmissionsPanel } from "../../../admin/course/[id]/AssignmentManagement"
import { CourseStatusToggle } from "../../../admin/course/[id]/CourseStatusToggle"
import { FeedbackSection } from "../../../admin/course/[id]/FeedbackSection"
import { CourseTabLayout } from "../../../admin/course/[id]/CourseTabLayout"
import { buildCourseOutline } from "../../../admin/course/[id]/courseOutline"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const course = await prisma.course.findUnique({ where: { id }, select: { name: true } })
  return { title: course ? `${course.name} — Trainer` : "Course" }
}

export default async function TrainerCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string
  const roles = ((session.user as any).roles as string[]) ?? []

  // Must be assigned trainer (admins can also access via /admin/course/[id])
  if (!roles.includes("ADMIN")) {
    const trainerRecord = await prisma.courseTrainer.findUnique({
      where: { courseId_userId: { courseId: id, userId } },
    })
    if (!trainerRecord) redirect("/trainer/course")
  }

  const [course, tests, assignment, feedbacks] = await Promise.all([
    prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        contents: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          include: {
            popQuizzes: {
              where: { deletedAt: null },
              orderBy: { time: "asc" },
              include: { options: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    }),
    prisma.test.findMany({
      where: { courseId: id, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.assignment.findFirst({
      where: { course: { id, deletedAt: null }, deletedAt: null },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            pathway: { select: { id: true, name: true } },
            gradedBy: { select: { name: true } },
          },
        },
      },
    }),
    prisma.courseFeedback.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ])

  if (!course) notFound()

  const youtubeContents = course.contents.filter((c) => c.type === "YOUTUBE_VIDEO").map((c) => ({ id: c.id, title: c.title }))
  const popQuizzes = course.contents.flatMap((c) => c.popQuizzes)
  const liveTests = tests.map((t) => ({ ...t, order: t.order! }))
  const outline = buildCourseOutline(course.contents, liveTests)

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <a href="/trainer/course" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        My Courses
      </a>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
            {course.description && (
              <p className="mt-2 text-sm text-slate-500">{course.description}</p>
            )}
          </div>
          <CourseStatusToggle id={course.id} status={course.status} />
        </div>
      </div>

      <CourseTabLayout
        content={
          <div className="flex flex-col gap-8">
            <ContentManagement courseId={course.id} contents={course.contents.map(c => ({ ...c, order: c.order! }))} outline={outline} />
            <PopQuizManagement courseId={course.id} youtubeContents={youtubeContents} popQuizzes={popQuizzes} />
            <TestManagement courseId={course.id} tests={liveTests} outline={outline} />
            <AssignmentManagement courseId={course.id} assignment={assignment} />
          </div>
        }
        submissions={<SubmissionsPanel courseId={course.id} assignment={assignment} />}
        feedback={<FeedbackSection courseId={course.id} feedbackEnabled={course.feedbackEnabled} feedbacks={feedbacks} />}
      />
    </main>
  )
}
