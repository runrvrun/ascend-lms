import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { DashboardSidebar } from "../components/DashboardSidebar"

export default async function DevManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const roles = ((session.user as any).roles as string[]) ?? []
  if (!roles.includes("DEVMANAGER")) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <DashboardSidebar session={session} />
      {children}
    </div>
  )
}
