import type { Metadata } from "next"
export const metadata: Metadata = { title: "User Guide" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { HelpContent } from "./HelpContent"

export default async function HelpPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />
      <HelpContent />
    </div>
  )
}
