"use client"

import { useState, useTransition } from "react"
import { EnrollmentStatus, EnrollmentType } from "@prisma/client"
import { Map, XCircle, ArrowRight, CheckCircle2, LogOut } from "lucide-react"
import { unenrollPathway } from "../pathways/actions"

type PathwayEnrollmentItem = {
  id: string
  pathwayId: string
  type: EnrollmentType
  status: EnrollmentStatus
  deadline: Date | null
  rejectionReason: string | null
  isCompleted: boolean
  pathway: { name: string; description: string | null }
  cohort: { name: string } | null
  approver: { name: string | null } | null
}

function enrollmentLabel(item: PathwayEnrollmentItem): string {
  if (item.cohort) return `From cohort: ${item.cohort.name}`
  if (item.type === "ASSIGNED") return item.approver?.name ? `Assigned by ${item.approver.name}` : "Assigned"
  if (item.type === "USER_REQUEST") return "Self-requested"
  return "Self-enrolled"
}

function DeadlineChip({ deadline }: { deadline: Date | null }) {
  if (!deadline) return null

  const days = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const overdue = days < 0

  const label = overdue ? `${Math.abs(days)}d overdue` : `${days}d left`
  const cls = overdue ? "bg-red-100 text-red-700" : days <= 7 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

function UnenrollButton({ pathwayId }: { pathwayId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Unenroll?</span>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await unenrollPathway(pathwayId) })}
          className="rounded px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? "…" : "Yes"}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-100">
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Unenroll"
      className="rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
    >
      <LogOut size={13} />
    </button>
  )
}

function EnrollmentRow({ item }: { item: PathwayEnrollmentItem }) {
  return (
    <li className={`px-6 py-4 ${item.isCompleted ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.isCompleted && <CheckCircle2 size={13} className="shrink-0 text-green-500" />}
            <p className="truncate font-medium text-slate-900">{item.pathway.name}</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{enrollmentLabel(item)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.isCompleted ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Completed</span>
          ) : item.status === "PENDING" ? (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Awaiting Approval</span>
          ) : (
            <DeadlineChip deadline={item.deadline} />
          )}
          {item.status === "APPROVED" && !item.isCompleted && (
            <a
              href={`/pathways/${item.pathwayId}`}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              Open <ArrowRight size={11} />
            </a>
          )}
          <UnenrollButton pathwayId={item.pathwayId} />
        </div>
      </div>
      {item.status === "REJECTED" && item.rejectionReason && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle size={12} className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">Reason: </span>{item.rejectionReason}</span>
        </div>
      )}
    </li>
  )
}

export function MyPathwaysCard({ enrollments }: { enrollments: PathwayEnrollmentItem[] }) {
  // Sort: Open (approved + not completed) → Awaiting Approval (pending) → Completed
  const sorted = [...enrollments].sort((a, b) => {
    const rank = (e: PathwayEnrollmentItem) => {
      if (e.isCompleted) return 2
      if (e.status === "PENDING") return 1
      return 0
    }
    return rank(a) - rank(b)
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
        <Map size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-900">My Pathways</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {enrollments.length}
        </span>
      </div>

      {enrollments.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-400">
          No pathways enrolled yet.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((item) => (
            <EnrollmentRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}
