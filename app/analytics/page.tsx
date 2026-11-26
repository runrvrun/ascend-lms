import type { Metadata } from "next"
export const metadata: Metadata = { title: "Analytics" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { canViewAnalytics } from "../lib/analytics"
import { AnalyticsDashboard, type AnalyticsSearchParams } from "../components/analytics/AnalyticsDashboard"

// One analytics page for every role; what it shows is limited to the viewer's scope
// (see resolveScope in app/lib/analytics.ts).
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const roles = ((session.user as { roles?: string[] }).roles) ?? []
  if (!canViewAnalytics(roles)) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />
      <AnalyticsDashboard
        viewer={{ id: (session.user as { id: string }).id, roles }}
        basePath="/analytics"
        searchParams={await searchParams}
      />
    </div>
  )
}
