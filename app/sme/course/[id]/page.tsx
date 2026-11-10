import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { ArrowLeft, Eye } from "lucide-react"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { CourseEditorTabs } from "../../../admin/course/[id]/CourseEditorTabs"
import { TrainerManagement } from "../../../admin/course/[id]/TrainerManagement"
import { CourseStatusToggle } from "../../../admin/course/[id]/CourseStatusToggle"

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

  const [course, trainers, allUsers] = await Promise.all([
    prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        topic: { select: { id: true, name: true } },
      },
    }),
    prisma.courseTrainer.findMany({
      where: { courseId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/sme/course/${course.id}/preview`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye size={14} />
              Preview
            </a>
            <CourseStatusToggle id={course.id} status={course.status} />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <TrainerManagement courseId={course.id} trainers={trainers} allUsers={allUsers} />
      </div>

      <CourseEditorTabs courseId={course.id} feedbackEnabled={course.feedbackEnabled} />
    </main>
  )
}
