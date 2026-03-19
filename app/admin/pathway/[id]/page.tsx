import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "../../../lib/prisma"
import { PathwayCourseManagement } from "./PathwayCourseManagement"

export default async function PathwayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [pathway, allCourses] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null },
      include: {
        courses: {
          orderBy: { order: "asc" },
          include: { course: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.course.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!pathway) notFound()

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <a href="/admin/pathway" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Back to Pathways
      </a>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{pathway.name}</h1>
        {pathway.description && (
          <p className="mt-2 text-sm text-slate-500">{pathway.description}</p>
        )}
      </div>

      <PathwayCourseManagement
        pathwayId={pathway.id}
        entries={pathway.courses}
        allCourses={allCourses}
      />
    </main>
  )
}
