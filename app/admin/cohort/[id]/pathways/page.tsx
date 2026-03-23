import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "../../../../lib/prisma"
import { CohortPathwayManagement } from "../CohortPathwayManagement"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const cohort = await prisma.cohort.findUnique({ where: { id }, select: { name: true } })
  return { title: cohort ? `${cohort.name} — Pathways` : "Cohort Pathways" }
}

export default async function CohortPathwaysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [cohort, allPathways] = await Promise.all([
    prisma.cohort.findFirst({
      where: { id, deletedAt: null },
      include: {
        pathways: {
          include: {
            pathway: {
              select: {
                id: true, name: true, description: true,
                _count: { select: { courses: true } },
              },
            },
          },
          orderBy: { pathway: { name: "asc" } },
        },
      },
    }),
    prisma.pathway.findMany({
      where: { deletedAt: null, status: "PUBLISHED" },
      select: {
        id: true, name: true, description: true,
        _count: { select: { courses: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  if (!cohort) notFound()

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <a href="/admin/cohort" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Back to Cohorts
      </a>

      <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cohort.name} — Pathways</h1>
          <p className="mt-1 text-sm text-slate-500">{cohort.pathways.length} pathway{cohort.pathways.length !== 1 ? "s" : ""} assigned</p>
        </div>
        <a
          href={`/admin/cohort/${id}`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Manage Members
        </a>
      </div>

      <CohortPathwayManagement
        cohortId={cohort.id}
        assignedPathways={cohort.pathways}
        allPathways={allPathways}
      />
    </main>
  )
}
