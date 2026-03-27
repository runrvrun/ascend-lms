"use client"

import { useState, useTransition } from "react"
import { X, CheckCircle2, XCircle, Clock } from "lucide-react"
import { approveRequest, rejectRequest } from "./actions"

type RequestRow = {
  id: string
  note: string | null
  user: { name: string | null; email: string | null }
  pathway: { name: string; description: string | null }
}

function RejectModal({
  request,
  onClose,
}: {
  request: RequestRow
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await rejectRequest(request.id, reason)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reject Request</h2>
            <p className="text-sm text-slate-500">{request.user.name ?? request.user.email} — {request.pathway.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this request is being rejected…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {pending ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RequestCard({ request }: { request: RequestRow }) {
  const [rejecting, setRejecting] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approveRequest(request.id)
    })
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{request.pathway.name}</p>
            <p className="text-sm text-slate-500">{request.user.name ?? request.user.email}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
            <Clock size={11} />
            Pending
          </span>
        </div>

        {request.note && (
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Reason from user</p>
            <p className="text-sm text-slate-700">{request.note}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {pending ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={14} />
            Reject
          </button>
        </div>
      </div>

      {rejecting && (
        <RejectModal request={request} onClose={() => setRejecting(false)} />
      )}
    </>
  )
}

export function PathwayRequestList({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
        No pending pathway requests from your team.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </div>
  )
}
