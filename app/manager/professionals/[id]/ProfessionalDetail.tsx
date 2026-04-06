"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  UserCircle2,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Pencil,
  X,
  Check,
  Target,
  BadgeCheck,
  UsersRound,
} from "lucide-react"
import { updateDeadline, confirmGrowthPlan } from "../actions"

type Enrollment = {
  id: string
  pathwayId: string
  type: string
  status: string
  deadline: string | null
  completedCourses: number
  totalCourses: number
  isCompleted: boolean
  pathway: { name: string }
  cohortName: string | null
}

type Professional = {
  id: string
  name: string | null
  email: string | null
  division: string
  title: string
  office: string | null
}

type GrowthPlanItem = {
  id: string
  title: string
  completedAt: string | null
  confirmedAt: string | null
  pathwayName: string | null
}

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

function DeadlineEditor({
  enrollmentId,
  deadline,
}: {
  enrollmentId: string
  deadline: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(deadline ? deadline.slice(0, 10) : "")
  const [pending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await updateDeadline(enrollmentId, value || null)
      setEditing(false)
    })
  }

  function handleClear() {
    startTransition(async () => {
      await updateDeadline(enrollmentId, null)
      setValue("")
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          disabled={pending}
          title="Save"
          className="rounded-lg p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
        >
          <Check size={13} />
        </button>
        {deadline && (
          <button
            onClick={handleClear}
            disabled={pending}
            title="Remove deadline"
            className="rounded-lg p-1 text-red-400 hover:bg-red-50 disabled:opacity-50"
          >
            <X size={13} />
          </button>
        )}
        <button
          onClick={() => setEditing(false)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
        >
          <ArrowLeft size={13} />
        </button>
      </div>
    )
  }

  if (deadline) {
    const d = new Date(deadline)
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const overdue = days < 0
    const chipCls = overdue
      ? "bg-red-100 text-red-700"
      : days <= 7
      ? "bg-orange-100 text-orange-700"
      : "bg-slate-100 text-slate-600"

    return (
      <div className="flex items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chipCls}`}>
          {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
        </span>
        <span className="text-xs text-slate-400">
          ({d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })})
        </span>
        <button
          onClick={() => setEditing(true)}
          title="Edit deadline"
          className="rounded p-0.5 text-slate-300 hover:text-slate-500"
        >
          <Pencil size={11} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600"
    >
      <Calendar size={12} />
      Set deadline
    </button>
  )
}

function EnrollmentRow({ enrollment }: { enrollment: Enrollment }) {
  const pct =
    enrollment.totalCourses > 0
      ? Math.round((enrollment.completedCourses / enrollment.totalCourses) * 100)
      : 0

  return (
    <div className="px-6 py-5">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {enrollment.isCompleted && (
              <CheckCircle2 size={15} className="shrink-0 text-green-500" />
            )}
            <p className="font-medium text-slate-900 truncate">{enrollment.pathway.name}</p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {enrollment.cohortName ? (
              <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                <UsersRound size={10} />
                {enrollment.cohortName}
              </span>
            ) : (
              <span className="text-xs text-slate-400 capitalize">
                {formatEnum(enrollment.type)}
              </span>
            )}
            {enrollment.status === "PENDING" && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                <Clock size={10} />
                Awaiting approval
              </span>
            )}
            {enrollment.isCompleted && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Completed
              </span>
            )}
          </div>
        </div>
        {enrollment.status === "APPROVED" && (
          <DeadlineEditor enrollmentId={enrollment.id} deadline={enrollment.deadline} />
        )}
      </div>

      {enrollment.status === "APPROVED" && enrollment.totalCourses > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              {enrollment.completedCourses}/{enrollment.totalCourses} courses
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full transition-all ${enrollment.isCompleted ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function GrowthPlanTab({ items }: { items: GrowthPlanItem[] }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<string | null>(null)

  function handleConfirm(id: string) {
    setConfirming(id)
    startTransition(async () => {
      await confirmGrowthPlan(id)
      setConfirming(null)
    })
  }

  if (items.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-slate-400">
        No growth plan items yet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => {
        const isCompleted = !!item.completedAt
        const isConfirmed = !!item.confirmedAt
        const canConfirm = isCompleted && !isConfirmed

        return (
          <div key={item.id} className="flex items-start gap-3 px-6 py-4">
            <div className="mt-0.5 shrink-0">
              {isCompleted ? (
                <CheckCircle2 size={16} className="text-green-500" />
              ) : (
                <Circle size={16} className="text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${isCompleted ? "text-slate-500 line-through" : "text-slate-900"}`}>
                {item.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.pathwayName && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                    {item.pathwayName}
                  </span>
                )}
                {isConfirmed && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <BadgeCheck size={11} />
                    Confirmed
                  </span>
                )}
                {isCompleted && !isConfirmed && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    Awaiting confirmation
                  </span>
                )}
              </div>
            </div>
            {canConfirm && (
              <button
                onClick={() => handleConfirm(item.id)}
                disabled={pending && confirming === item.id}
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                <BadgeCheck size={13} />
                Confirm
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ProfessionalDetail({
  professional,
  enrollments,
  growthPlans,
}: {
  professional: Professional
  enrollments: Enrollment[]
  growthPlans: GrowthPlanItem[]
}) {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<"learning" | "growth">(
    searchParams.get("tab") === "growth" ? "growth" : "learning"
  )
  const approved = enrollments.filter((e) => e.status === "APPROVED")
  const completed = approved.filter((e) => e.isCompleted).length
  const pending = enrollments.filter((e) => e.status === "PENDING").length
  const pendingConfirm = growthPlans.filter((g) => g.completedAt && !g.confirmedAt).length

  return (
    <>
      {/* Back */}
      <a
        href="/manager/professionals"
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} />
        Back to Professionals
      </a>

      {/* Profile header */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
            <UserCircle2 size={28} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">{professional.name ?? "—"}</h1>
            <p className="text-sm text-slate-500">{professional.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {professional.division}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {formatEnum(professional.title)}
              </span>
              {professional.office && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {professional.office}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">{approved.length}</p>
              <p className="text-xs text-slate-400">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{completed}</p>
              <p className="text-xs text-slate-400">Completed</p>
            </div>
            {pending > 0 && (
              <div>
                <p className="text-2xl font-bold text-yellow-600">{pending}</p>
                <p className="text-xs text-slate-400">Pending</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("learning")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "learning"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Learning Progress
        </button>
        <button
          onClick={() => setTab("growth")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "growth"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Target size={14} />
          Growth Plan
          {pendingConfirm > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
              {pendingConfirm}
            </span>
          )}
        </button>
      </div>

      {/* Learning Progress tab */}
      <div className={tab === "learning" ? "" : "hidden"}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Learning Progress</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Click the pencil icon on any pathway to set or adjust a deadline.
            </p>
          </div>
          {enrollments.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">
              No pathway enrollments yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {enrollments.map((e) => (
                <EnrollmentRow key={e.id} enrollment={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Growth Plan tab */}
      <div className={tab === "growth" ? "" : "hidden"}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Growth Plan</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Confirm completed items to acknowledge the professional's progress.
            </p>
          </div>
          <GrowthPlanTab items={growthPlans} />
        </div>
      </div>
    </>
  )
}
