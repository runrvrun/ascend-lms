import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { SidebarWithStats } from "../components/SidebarWithStats"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const roles = ((session.user as any).roles as string[]) ?? []
  if (!roles.includes("ADMIN")) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />
      {children}
    </div>
  )
}
