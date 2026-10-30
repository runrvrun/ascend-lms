import type { Metadata } from "next"
export const metadata: Metadata = { title: "Team Analytics" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { AnalyticsDashboard, type AnalyticsSearchParams } from "../../components/analytics/AnalyticsDashboard"

export default async function ManagerAnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  return (
    <AnalyticsDashboard
      role="manager"
      viewerId={(session.user as { id: string }).id}
      basePath="/manager/analytics"
      title="Team Analytics"
      subtitle="Learning metrics for your team, by person, pathway and course"
      searchParams={await searchParams}
    />
  )
}
