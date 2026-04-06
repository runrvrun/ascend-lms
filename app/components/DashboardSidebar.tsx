"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Session } from "next-auth"
import { Home, Map, ShieldCheck, Users, ChevronDown, UserCog, BookOpen, GraduationCap, UsersRound, ClipboardList, Building2, BarChart3, Flame, Star, Bell, Settings, KeyRound, LogOut, PenLine, Target, Lightbulb, Tag, HelpCircle } from "lucide-react"

interface DashboardSidebarProps {
  session: Session | null
  streak?: number
  totalPoints?: number
  unreadNotifications?: number
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

function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Settings"
        className={`rounded-lg p-1 transition-colors ${open ? "bg-white/20 text-white" : "text-white/40 hover:bg-white/15 hover:text-white/80"}`}
      >
        <Settings size={14} />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-[9999] w-44 rounded-xl border border-white/10 bg-[#0d2a6e] py-1 shadow-xl">
          <a
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-xs text-blue-100 hover:bg-white/10"
          >
            <KeyRound size={13} />
            Change Password
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-red-300 hover:bg-white/10"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function DashboardSidebar({ session, streak = 0, totalPoints = 0, unreadNotifications = 0 }: DashboardSidebarProps) {
  const roles = ((session?.user as any)?.roles as string[]) ?? []
  const isAdmin = roles.includes("ADMIN")
  const isManager = roles.includes("MANAGER")
  const isTrainer = roles.includes("TRAINER")
  const isSME = roles.includes("SME")
  const [adminOpen, setAdminOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [trainerOpen, setTrainerOpen] = useState(false)
  const [smeOpen, setSmeOpen] = useState(false)

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
        <a href="/growth-plan" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
          <Target size={16} />
          My Growth Plan
        </a>
        <a href="/help" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
          <HelpCircle size={16} />
          Help
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
                <a href="/admin/topic" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <Tag size={14} />
                  Topics
                </a>
                <a href="/admin/analytics" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <BarChart3 size={14} />
                  Analytics
                </a>
              </div>
            )}
          </div>
        )}
        {isManager && (
          <div>
            <button
              onClick={() => setManagerOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <Users size={16} />
              Manager
              <ChevronDown size={14} className={`ml-auto transition-transform ${managerOpen ? "rotate-180" : ""}`} />
            </button>
            {managerOpen && (
              <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                <a href="/manager/professionals" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <UsersRound size={14} />
                  Professionals
                </a>
                <a href="/manager/pathway-request" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <ClipboardList size={14} />
                  Pathway Requests
                </a>
                <a href="/manager/analytics" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <BarChart3 size={14} />
                  Analytics
                </a>
              </div>
            )}
          </div>
        )}
        {isTrainer && (
          <div>
            <button
              onClick={() => setTrainerOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <PenLine size={16} />
              Trainer
              <ChevronDown size={14} className={`ml-auto transition-transform ${trainerOpen ? "rotate-180" : ""}`} />
            </button>
            {trainerOpen && (
              <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                <a href="/trainer/course" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <GraduationCap size={14} />
                  My Courses
                </a>
              </div>
            )}
          </div>
        )}
        {isSME && (
          <div>
            <button
              onClick={() => setSmeOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <Lightbulb size={16} />
              Subject Matter Expert
              <ChevronDown size={14} className={`ml-auto transition-transform ${smeOpen ? "rotate-180" : ""}`} />
            </button>
            {smeOpen && (
              <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                <a href="/sme/course" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-100 hover:bg-white/15">
                  <GraduationCap size={14} />
                  My Topics
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-2">
        <div className="rounded-xl bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <UserAvatar name={session?.user?.name} image={session?.user?.image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{session?.user?.name ?? "Unknown"}</p>
            </div>
            <a href="/notifications" className="relative shrink-0 rounded-lg p-1.5 text-white/70 hover:bg-white/15 hover:text-white">
              <Bell size={16} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </a>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${streak > 0 ? "bg-orange-500/30 text-orange-200" : "bg-white/10 text-white/40"}`}>
              <Flame size={11} className={streak > 0 ? "text-orange-300" : ""} />
              {streak > 0 ? `${streak}-day streak` : "No streak"}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-semibold text-yellow-200">
              <Star size={11} className="text-yellow-300" />
              {totalPoints.toLocaleString()} pts
            </div>
            <SettingsMenu />
          </div>
        </div>
      </div>
    </aside>
  )
}
