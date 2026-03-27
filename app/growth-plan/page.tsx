import type { Metadata } from "next"
export const metadata: Metadata = { title: "My Growth Plan" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { GrowthPlanClient } from "./GrowthPlanClient"

export default async function GrowthPlanPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const items = await prisma.growthPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      pathwayId: true,
      completedAt: true,
      confirmedAt: true,
      pathway: { select: { name: true } },
    },
  })

  const normalized = items.map((i) => ({
    id: i.id,
    title: i.title,
    pathwayId: i.pathwayId,
    pathwayName: i.pathway?.name ?? null,
    completedAt: i.completedAt,
    confirmedAt: i.confirmedAt,
  }))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />
      <main className="mx-auto min-h-screen w-full max-w-3xl p-6 md:p-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">My Growth Plan</h1>
          <p className="mt-1 text-sm text-slate-500">Track what you plan to do after your training.</p>
        </div>
        <GrowthPlanClient items={normalized} />
      </main>
    </div>
  )
}
