import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "../../../lib/prisma"
import { CohortMemberManagement } from "./CohortMemberManagement"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const cohort = await prisma.cohort.findUnique({ where: { id }, select: { name: true } })
  return { title: cohort ? `${cohort.name} — Cohort` : "Cohort" }
}

export default async function CohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const officeSelect = { select: { id: true, name: true } } as const

  const [cohort, allUsersRaw] = await Promise.all([
    prisma.cohort.findFirst({
      where: { id, deletedAt: null },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true,
                division: true, title: true,
                office: officeSelect,
              },
            },
          },
          orderBy: { user: { name: "asc" } },
        },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true,
        division: true, title: true,
        office: officeSelect,
      },
      orderBy: { name: "asc" },
    }),
  ])

  if (!cohort) notFound()

  // Flatten office object → string for the component
  const allUsers = allUsersRaw.map((u) => ({ ...u, office: u.office?.name ?? null }))
  const members = cohort.users.map((m) => ({
    ...m,
    user: { ...m.user, office: m.user.office?.name ?? null },
  }))

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <a href="/admin/cohort" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Back to Cohorts
      </a>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{cohort.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{cohort.users.length} member{cohort.users.length !== 1 ? "s" : ""}</p>
      </div>

      <CohortMemberManagement
        cohortId={cohort.id}
        members={members}
        allUsers={allUsers}
      />
    </main>
  )
}
