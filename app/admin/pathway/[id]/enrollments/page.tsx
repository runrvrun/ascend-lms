import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "../../../../lib/prisma"
import { PathwayEnrollmentManagement } from "./PathwayEnrollmentManagement"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const pathway = await prisma.pathway.findUnique({ where: { id }, select: { name: true } })
  return { title: pathway ? `${pathway.name} — Enrollments` : "Enrollments" }
}

export default async function PathwayEnrollmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [pathway, allUsers, allCohorts, allEnrolledUserIds] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        pathwayEnrollments: {
          where: { cohortId: null },
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true, division: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        cohortPathways: {
          select: {
            id: true,
            cohort: {
              select: {
                id: true,
                name: true,
                _count: { select: { users: true } },
              },
            },
          },
          orderBy: { id: "desc" },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, division: true },
      orderBy: { name: "asc" },
    }),
    prisma.cohort.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.pathwayEnrollment.findMany({
      where: { pathwayId: id },
      select: { userId: true },
    }),
  ])

  if (!pathway) notFound()

  const enrolledUserIdSet = new Set(allEnrolledUserIds.map((e) => e.userId))
  const assignedCohortIdSet = new Set(pathway.cohortPathways.map((cp) => cp.cohort.id))

  const availableUsers = allUsers.filter((u) => !enrolledUserIdSet.has(u.id))
  const availableCohorts = allCohorts.filter((c) => !assignedCohortIdSet.has(c.id))

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <div className="mb-6 flex items-center gap-4">
        <a
          href={`/admin/pathway/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={15} />
          Back to Pathway
        </a>
        <span className="text-slate-300">/</span>
        <a href="/admin/pathway" className="text-sm text-slate-500 hover:text-slate-800">
          All Pathways
        </a>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{pathway.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Enrollment management</p>
      </div>

      <PathwayEnrollmentManagement
        pathwayId={pathway.id}
        individualEnrollments={pathway.pathwayEnrollments}
        cohortAssignments={pathway.cohortPathways}
        availableUsers={availableUsers}
        availableCohorts={availableCohorts}
      />
    </main>
  )
}
