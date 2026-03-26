import type { Metadata } from "next"
export const metadata: Metadata = { title: "Settings" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { ChangePasswordForm } from "./ChangePasswordForm"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-2xl p-6 md:p-10">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">Settings</h1>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-slate-900">Change Password</h2>
          <p className="mb-6 text-sm text-slate-500">
            Set or update your password for email sign-in.
          </p>
          <ChangePasswordForm />
        </div>
      </main>
    </div>
  )
}
