import type { Metadata } from "next"
export const metadata: Metadata = { title: "Analytics" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { AnalyticsDashboard, type AnalyticsSearchParams } from "../../components/analytics/AnalyticsDashboard"

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  return (
    <AnalyticsDashboard
      role="admin"
      viewerId={(session.user as { id: string }).id}
      basePath="/admin/analytics"
      title="Analytics"
      subtitle="Learning across the whole company, by user, pathway and course"
      searchParams={await searchParams}
    />
  )
}
