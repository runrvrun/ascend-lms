"use client"

import { useState, useTransition } from "react"
import { ArrowRight, LogOut } from "lucide-react"
import { unenrollPathway } from "../pathways/actions"
import type { LearnerPathway, LearnerPathwayState } from "../lib/learnerPathways"

const STATE_BADGE: Record<LearnerPathwayState, { label: string; cls: string }> = {
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
  NOT_STARTED: { label: "Not Started", cls: "bg-slate-100 text-slate-600" },
  PENDING: { label: "Awaiting Approval", cls: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "Completed", cls: "bg-green-100 text-green-700" },
}

export function StateBadge({ state }: { state: LearnerPathwayState }) {
  const { label, cls } = STATE_BADGE[state]
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

export function enrollmentLabel(item: Pick<LearnerPathway, "cohortName" | "type" | "approverName">): string {
  if (item.cohortName) return `From cohort: ${item.cohortName}`
  if (item.type === "ASSIGNED") return item.approverName ? `Assigned by ${item.approverName}` : "Assigned"
  if (item.type === "USER_REQUEST") return "Self-requested"
  return "Self-enrolled"
}

export function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function DeadlineChip({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const overdue = days < 0
  const label = overdue ? `${Math.abs(days)}d overdue` : `${days}d left`
  const cls = overdue ? "bg-red-100 text-red-700" : days <= 7 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs text-slate-500">
        {done}/{total} course{total !== 1 ? "s" : ""}
      </span>
    </div>
  )
}

// Same look as the Go to Pathway button on the Pathways page.
export function GoToPathwayButton({ pathwayId }: { pathwayId: string }) {
  return (
    <a
      href={`/pathways/${pathwayId}`}
      className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
    >
      Go to Pathway
      <ArrowRight size={14} />
    </a>
  )
}

export function UnenrollButton({ pathwayId }: { pathwayId: string }) {
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
      className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
    >
      <LogOut size={14} />
    </button>
  )
}

// One pathway row: name + state, how you joined + last activity, progress,
// then Go to Pathway / unenroll. Used by the dashboard card and Learning History.
export function LearnerPathwayRow({ item }: { item: LearnerPathway }) {
  const canOpen = item.status === "APPROVED"
  const canUnenroll = item.state !== "COMPLETED"
  return (
    <li className="px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-medium text-slate-900">{item.name}</p>
        <StateBadge state={item.state} />
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {enrollmentLabel(item)}
        {item.lastActivityAt && <> · Last activity {formatShortDate(item.lastActivityAt)}</>}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <ProgressBar done={item.completedCourses} total={item.totalCourses} />
        {item.status === "APPROVED" && item.state !== "COMPLETED" && <DeadlineChip deadline={item.deadline} />}
      </div>
      {(canOpen || canUnenroll) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {canOpen ? <GoToPathwayButton pathwayId={item.pathwayId} /> : <span />}
          {canUnenroll && <UnenrollButton pathwayId={item.pathwayId} />}
        </div>
      )}
    </li>
  )
}
