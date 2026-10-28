import type { Metadata } from "next"
export const metadata: Metadata = { title: "User Management" }

import { prisma } from "../../lib/prisma"
import { ASSIGNMENT_COUNTS, deriveRoles } from "../../lib/userRoles"
import { UserManagement } from "./UserManagement"

export default async function AdminUserPage() {
  const [users, allManagers, cohorts, offices] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        managers: { select: { managerId: true, manager: { select: { id: true, name: true } } } },
        roles: { select: { role: true } },
        _count: { select: ASSIGNMENT_COUNTS },
        cohorts: { select: { cohortId: true } },
        office: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.cohort.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.office.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <UserManagement
        users={users.map(({ _count, ...u }) => ({ ...u, derivedRoles: deriveRoles(u.roles, _count) }))}
        allManagers={allManagers}
        cohorts={cohorts}
        offices={offices}
      />
    </main>
  )
}
