import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { SidebarWithStats } from "../components/SidebarWithStats"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const roles = ((session.user as any).roles as string[]) ?? []
  // Pathway owners get in for /admin/pathway only; every other admin section has its
  // own admin-only layout (app/admin/*/layout.tsx).
  if (!roles.includes("ADMIN") && !roles.includes("PATHWAY_OWNER")) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />
      {children}
    </div>
  )
}
