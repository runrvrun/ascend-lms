import { EnrollmentStatus, EnrollmentType } from "@prisma/client"
import { Map, XCircle, ArrowRight } from "lucide-react"

type PathwayEnrollmentItem = {
  id: string
  pathwayId: string
  type: EnrollmentType
  status: EnrollmentStatus
  deadline: Date | null
  rejectionReason: string | null
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

  let label: string
  let cls: string

  if (overdue) {
    label = `${Math.abs(days)}d overdue`
    cls = "bg-red-100 text-red-700"
  } else if (days <= 7) {
    label = `${days}d left`
    cls = "bg-orange-100 text-orange-700"
  } else {
    label = `${days}d left`
    cls = "bg-slate-100 text-slate-600"
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: EnrollmentStatus }) {
  if (status === "APPROVED") return null
  const cls = status === "PENDING" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
  const label = status === "PENDING" ? "Awaiting Approval" : "Rejected"
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

export function MyPathwaysCard({ enrollments }: { enrollments: PathwayEnrollmentItem[] }) {
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
          {enrollments.map((item) => (
            <li key={item.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{item.pathway.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{enrollmentLabel(item)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={item.status} />
                  <DeadlineChip deadline={item.deadline} />
                  {item.status === "APPROVED" && (
                    <a
                      href={`/pathways/${item.pathwayId}`}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Open <ArrowRight size={11} />
                    </a>
                  )}
                </div>
              </div>
              {item.status === "REJECTED" && item.rejectionReason && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <XCircle size={12} className="mt-0.5 shrink-0" />
                  <span><span className="font-semibold">Reason: </span>{item.rejectionReason}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
