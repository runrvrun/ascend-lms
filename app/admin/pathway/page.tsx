import type { Metadata } from "next"
export const metadata: Metadata = { title: "Pathway Management" }

import { redirect } from "next/navigation"
import { prisma } from "../../lib/prisma"
import { getSessionUser } from "../../lib/permissions"
import { PathwayManagement } from "./PathwayManagement"

export default async function AdminPathwayPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")
  const isAdmin = user.roles.includes("ADMIN")

  const [pathways, ownerOptions] = await Promise.all([
    prisma.pathway.findMany({
      // Non-admin owners only see the pathways they own
      where: { deletedAt: null, ...(isAdmin ? {} : { owners: { some: { userId: user.id } } }) },
      include: {
        _count: { select: { courses: true } },
        pathwayEnrollments: { where: { cohortId: null }, select: { id: true } },
        cohortPathways: {
          select: { cohort: { select: { _count: { select: { users: true } } } } },
        },
        owners: { select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ])

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <PathwayManagement pathways={pathways} isAdmin={isAdmin} ownerOptions={ownerOptions} />
    </main>
  )
}
