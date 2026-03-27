import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { GraduationCap, FileText, ClipboardList, ClipboardCheck } from "lucide-react"

export const metadata: Metadata = { title: "My Courses — Trainer" }

export default async function TrainerCoursesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string

  const assignments = await prisma.courseTrainer.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          _count: { select: { contents: { where: { deletedAt: null } } } },
          test: { where: { deletedAt: null }, select: { id: true } },
          assignment: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
    orderBy: { course: { name: "asc" } },
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Courses</h1>
        <p className="mt-1 text-sm text-slate-500">Courses you are assigned to as a trainer.</p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-400">
          You have not been assigned to any courses yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignments.map(({ course }) => (
            <a
              key={course.id}
              href={`/trainer/course/${course.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <GraduationCap size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{course.name}</p>
                  {course.description && (
                    <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{course.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileText size={12} />
                  {course._count.contents} content{course._count.contents !== 1 ? "s" : ""}
                </span>
                {course.test && (
                  <span className="flex items-center gap-1">
                    <ClipboardList size={12} />
                    Test
                  </span>
                )}
                {course.assignment && (
                  <span className="flex items-center gap-1">
                    <ClipboardCheck size={12} />
                    Assignment
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
