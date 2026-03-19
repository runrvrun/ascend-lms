"use client"

import { useState, useTransition } from "react"
import {
  ArrowLeft,
  UserCircle2,
  CheckCircle2,
  Clock,
  Calendar,
  Pencil,
  X,
  Check,
} from "lucide-react"
import { updateDeadline } from "../actions"

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
}

type Professional = {
  id: string
  name: string | null
  email: string | null
  division: string
  title: string
  office: string | null
}

function formatEnum(val: string) {
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
            <span className="text-xs text-slate-400 capitalize">
              {formatEnum(enrollment.type)}
            </span>
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

export function ProfessionalDetail({
  professional,
  enrollments,
}: {
  professional: Professional
  enrollments: Enrollment[]
}) {
  const approved = enrollments.filter((e) => e.status === "APPROVED")
  const completed = approved.filter((e) => e.isCompleted).length
  const pending = enrollments.filter((e) => e.status === "PENDING").length

  return (
    <>
      {/* Back */}
      <a
        href="/devmanager/professionals"
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

      {/* Enrollments */}
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
    </>
  )
}
