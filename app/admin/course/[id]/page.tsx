import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Eye } from "lucide-react"
import { prisma } from "../../../lib/prisma"
import { CourseEditorTabs } from "./CourseEditorTabs"
import { TrainerManagement } from "./TrainerManagement"
import { CourseStatusToggle } from "./CourseStatusToggle"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const course = await prisma.course.findUnique({ where: { id }, select: { name: true } })
  return { title: course ? `${course.name} — Course` : "Course" }
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [course, trainers, allUsers] = await Promise.all([
    prisma.course.findFirst({
      where: { id, deletedAt: null },
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
      <a href="/admin/course" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Back to Courses
      </a>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
            {course.description && (
              <p className="mt-2 text-sm text-slate-500">{course.description}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span>Created {course.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span>·</span>
              <span>Updated {course.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/admin/course/${course.id}/preview`}
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
