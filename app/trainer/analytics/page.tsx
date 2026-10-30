import type { Metadata } from "next"
export const metadata: Metadata = { title: "Analytics — Trainer" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { AnalyticsDashboard, type AnalyticsSearchParams } from "../../components/analytics/AnalyticsDashboard"

export default async function TrainerAnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  return (
    <AnalyticsDashboard
      role="trainer"
      viewerId={(session.user as { id: string }).id}
      basePath="/trainer/analytics"
      title="Course Analytics"
      subtitle="How learners are doing in the courses you train"
      searchParams={await searchParams}
    />
  )
}
