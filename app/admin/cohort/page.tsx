import type { Metadata } from "next"
export const metadata: Metadata = { title: "Cohort Management" }

import { prisma } from "../../lib/prisma"
import { CohortManagement } from "./CohortManagement"

export default async function AdminCohortPage() {
  const cohorts = await prisma.cohort.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: "asc" },
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <CohortManagement cohorts={cohorts} />
    </main>
  )
}
