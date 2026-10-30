import type { Metadata } from "next"
export const metadata: Metadata = { title: "Analytics — SME" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { AnalyticsDashboard, type AnalyticsSearchParams } from "../../components/analytics/AnalyticsDashboard"

export default async function SmeAnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  return (
    <AnalyticsDashboard
      role="sme"
      viewerId={(session.user as { id: string }).id}
      basePath="/sme/analytics"
      title="Topic Analytics"
      subtitle="How learners are doing in the courses and pathways of your topics"
      searchParams={await searchParams}
    />
  )
}
