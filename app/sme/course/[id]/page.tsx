import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { ContentManagement } from "../../../admin/course/[id]/ContentManagement"
import { TestManagement } from "../../../admin/course/[id]/TestManagement"
import { AssignmentManagement, SubmissionsPanel } from "../../../admin/course/[id]/AssignmentManagement"
import { TrainerManagement } from "../../../admin/course/[id]/TrainerManagement"
import { CourseStatusToggle } from "../../../admin/course/[id]/CourseStatusToggle"
import { FeedbackSection } from "../../../admin/course/[id]/FeedbackSection"
import { CourseTabLayout } from "../../../admin/course/[id]/CourseTabLayout"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const course = await prisma.course.findUnique({ where: { id }, select: { name: true } })
  return { title: course ? `${course.name} — SME` : "Course" }
}

export default async function SmeCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string
  const roles = ((session.user as any).roles as string[]) ?? []

  // SMEs can access any course in their topics; admins bypass
  if (!roles.includes("ADMIN")) {
    const course = await prisma.course.findUnique({ where: { id }, select: { topicId: true } })
    if (!course?.topicId) redirect("/sme/course")
    const isSME = await prisma.topicSME.findUnique({
      where: { topicId_userId: { topicId: course.topicId, userId } },
    })
    if (!isSME) redirect("/sme/course")
  }

  const [course, test, trainers, allUsers, assignment, feedbacks] = await Promise.all([
    prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        contents: { where: { deletedAt: null }, orderBy: { order: "asc" } },
        topic: { select: { id: true, name: true } },
      },
    }),
    prisma.test.findFirst({
      where: { course: { id, deletedAt: null } },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.courseTrainer.findMany({
      where: { courseId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: "TRAINER" } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <a href="/sme/course" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        My Topics
      </a>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
            {course.topic && (
              <span className="mt-1 inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                {course.topic.name}
              </span>
            )}
            {course.description && (
              <p className="mt-2 text-sm text-slate-500">{course.description}</p>
            )}
          </div>
          <CourseStatusToggle id={course.id} status={course.status} />
        </div>
      </div>

      <div className="mb-8">
        <TrainerManagement courseId={course.id} trainers={trainers} allUsers={allUsers} />
      </div>

      <CourseTabLayout
        content={
          <div className="flex flex-col gap-8">
            <ContentManagement courseId={course.id} contents={course.contents} />
            <TestManagement courseId={course.id} test={test} />
            <AssignmentManagement courseId={course.id} assignment={assignment} />
          </div>
        }
        submissions={<SubmissionsPanel courseId={course.id} assignment={assignment} />}
        feedback={<FeedbackSection courseId={course.id} feedbackEnabled={course.feedbackEnabled} feedbacks={feedbacks} />}
      />
    </main>
  )
}
