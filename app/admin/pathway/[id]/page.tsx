import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Users, Eye } from "lucide-react"
import { prisma } from "../../../lib/prisma"
import { PathwayCourseManagement } from "./PathwayCourseManagement"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const pathway = await prisma.pathway.findUnique({ where: { id }, select: { name: true } })
  return { title: pathway ? `${pathway.name} — Pathway` : "Pathway" }
}

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{pathway.name}</h1>
            {pathway.description && (
              <p className="mt-2 text-sm text-slate-500">{pathway.description}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span>Created {pathway.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span>·</span>
              <span>Updated {pathway.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/pathways/${pathway.id}?preview=1`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye size={14} />
              Preview
            </a>
            <a
              href={`/admin/pathway/${pathway.id}/enrollments`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Users size={14} />
              Manage Enrollments
            </a>
          </div>
        </div>
      </div>

      <PathwayCourseManagement
        pathwayId={pathway.id}
        entries={pathway.courses}
        allCourses={allCourses}
      />
    </main>
  )
}
