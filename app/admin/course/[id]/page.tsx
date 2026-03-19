import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "../../../lib/prisma"
import { ContentManagement } from "./ContentManagement"
import { TestManagement } from "./TestManagement"

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [course, test] = await Promise.all([
    prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        contents: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.test.findFirst({
      where: { course: { id, deletedAt: null } },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          include: {
            options: { orderBy: { order: "asc" } },
          },
        },
      },
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
        <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
        {course.description && (
          <p className="mt-2 text-sm text-slate-500">{course.description}</p>
        )}
      </div>

      <ContentManagement courseId={course.id} contents={course.contents} />

      <div className="mt-8">
        <TestManagement courseId={course.id} test={test} />
      </div>
    </main>
  )
}
