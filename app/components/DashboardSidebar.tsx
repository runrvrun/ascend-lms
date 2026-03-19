"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Session } from "next-auth"
import { Home, Map, ShieldCheck, Users, ChevronDown, UserCog, BookOpen, GraduationCap, UsersRound, ClipboardList, Building2, BarChart3 } from "lucide-react"

interface DashboardSidebarProps {
  session: Session | null
}

const sidebarBackground = {
  background: "radial-gradient(circle at 30% 50%, #3D6AAE 0%, #194693 25%, #03368C 45%, #092656 70%, #092656 100%)",
}

function UserAvatar({ name, image }: { name?: string | null; image?: string | null }) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")

  if (image) {
    return (
      <img
        src={image}
        alt={name ?? "User"}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
      />
    )
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30 text-xs font-bold text-white">
      {initials || "?"}
    </div>
  )
}

export function DashboardSidebar({ session }: DashboardSidebarProps) {
  const roles = ((session?.user as any)?.roles as string[]) ?? []
  const isAdmin = roles.includes("ADMIN")
  const isDevManager = roles.includes("DEVMANAGER")
  const [adminOpen, setAdminOpen] = useState(false)
  const [devManagerOpen, setDevManagerOpen] = useState(false)

  return (
    <aside className="relative overflow-hidden flex h-screen w-full md:w-72 flex-col border-r border-slate-100 md:fixed md:left-0 md:top-0 md:bottom-0 md:z-20" style={sidebarBackground}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          opacity: 0.25,
        }}
      />
      <div className="flex flex-col gap-2 p-5 text-white">
        <div className="flex items-center gap-2">
          <img src="/logo-ycp-white.svg" alt="YCP Logo" className="h-8 w-auto" />
          <div className="text-lg font-bold">Ascend</div>
        </div>
        <p className="text-xs text-blue-200">Training Platform</p>
      </div>

      <nav className="mb-auto flex flex-col gap-1 px-4 pt-4">
        <a href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
          <Home size={16} />
          Home
        </a>
        <a href="/pathways" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
          <Map size={16} />
          Pathways
        </a>
      </nav>

      <div className="flex flex-col gap-1 px-4 pb-2">
        {isAdmin && (
          <div>
            <button
              onClick={() => setAdminOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <ShieldCheck size={16} />
              Admin
              <ChevronDown size={14} className={`ml-auto transition-transform ${adminOpen ? "rotate-180" : ""}`} />
            </button>
            {adminOpen && (
              <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                <a href="/admin/user" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <UserCog size={14} />
                  Users
                </a>
                <a href="/admin/cohort" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <UsersRound size={14} />
                  Cohorts
                </a>
                <a href="/admin/pathway" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <BookOpen size={14} />
                  Pathways
                </a>
                <a href="/admin/course" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <GraduationCap size={14} />
                  Courses
                </a>
                <a href="/admin/office" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <Building2 size={14} />
                  Offices
                </a>
                <a href="/admin/analytics" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <BarChart3 size={14} />
                  Analytics
                </a>
              </div>
            )}
          </div>
        )}
        {isDevManager && (
          <div>
            <button
              onClick={() => setDevManagerOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <Users size={16} />
              Development Manager
              <ChevronDown size={14} className={`ml-auto transition-transform ${devManagerOpen ? "rotate-180" : ""}`} />
            </button>
            {devManagerOpen && (
              <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                <a href="/devmanager/professionals" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <UsersRound size={14} />
                  Professionals
                </a>
                <a href="/devmanager/pathway-request" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <ClipboardList size={14} />
                  Pathway Requests
                </a>
                <a href="/devmanager/analytics" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <BarChart3 size={14} />
                  Analytics
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <UserAvatar name={session?.user?.name} image={session?.user?.image} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{session?.user?.name ?? "Unknown"}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-blue-200 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
