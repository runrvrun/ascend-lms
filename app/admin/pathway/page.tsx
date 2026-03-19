import type { Metadata } from "next"
export const metadata: Metadata = { title: "Pathway Management" }

import { prisma } from "../../lib/prisma"
import { PathwayManagement } from "./PathwayManagement"

export default async function AdminPathwayPage() {
  const pathways = await prisma.pathway.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: { courses: true, pathwayEnrollments: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <PathwayManagement pathways={pathways} />
    </main>
  )
}
