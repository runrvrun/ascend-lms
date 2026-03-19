"use client"

import { useState, useTransition } from "react"
import { Search, BookOpen, X, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react"
import { EnrollmentStatus } from "@prisma/client"
import { enrollPathway, requestPathway } from "./actions"

type EnrollmentInfo = {
  status: EnrollmentStatus
  note: string | null
  rejectionReason: string | null
}

type PathwayCard = {
  id: string
  name: string
  description: string | null
  requiresApproval: boolean
  _count: { courses: number }
  enrollment: EnrollmentInfo | null
}

function RequestModal({
  pathway,
  onClose,
}: {
  pathway: PathwayCard
  onClose: () => void
}) {
  const [note, setNote] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await requestPathway(pathway.id, note)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Request Enrollment</h2>
            <p className="text-sm text-slate-500">{pathway.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Why do you want to enroll? <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Briefly explain your reason for joining this pathway…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PathwayCardItem({ pathway }: { pathway: PathwayCard }) {
  const [requesting, setRequesting] = useState(false)
  const [pending, startTransition] = useTransition()
  const { enrollment } = pathway

  function handleEnroll() {
    startTransition(async () => {
      await enrollPathway(pathway.id)
    })
  }

  const enrollmentStatus = enrollment?.status

  function ActionButton() {
    if (enrollmentStatus === "APPROVED") {
      return (
        <a
          href={`/pathways/${pathway.id}`}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to Pathway
          <ArrowRight size={14} />
        </a>
      )
    }

    if (enrollmentStatus === "PENDING") {
      return (
        <button disabled className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed">
          <Clock size={14} />
          Awaiting Approval
        </button>
      )
    }

    if (pathway.requiresApproval) {
      return (
        <button
          onClick={() => setRequesting(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Request Enrollment
        </button>
      )
    }

    return (
      <button
        onClick={handleEnroll}
        disabled={pending}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll"}
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <BookOpen size={17} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 leading-snug">{pathway.name}</h3>
          </div>
          {pathway.requiresApproval ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Approval required</span>
          ) : (
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Free enroll</span>
          )}
        </div>

        {pathway.description && (
          <p className="mb-3 text-sm text-slate-500 line-clamp-2">{pathway.description}</p>
        )}

        <p className="mb-4 text-xs text-slate-400">{pathway._count.courses} course{pathway._count.courses !== 1 ? "s" : ""}</p>

        {enrollmentStatus === "REJECTED" && enrollment?.rejectionReason && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <XCircle size={13} className="mt-0.5 shrink-0" />
            <span><span className="font-semibold">Rejected:</span> {enrollment.rejectionReason}</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between">
          <ActionButton />
        </div>
      </div>

      {requesting && (
        <RequestModal pathway={pathway} onClose={() => setRequesting(false)} />
      )}
    </>
  )
}

export function PathwayList({ pathways }: { pathways: PathwayCard[] }) {
  const [search, setSearch] = useState("")

  const filtered = search
    ? pathways.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : pathways

  return (
    <>
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pathways…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
          {pathways.length === 0 ? "No pathways available yet." : "No pathways match your search."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <PathwayCardItem key={p.id} pathway={p} />
          ))}
        </div>
      )}
    </>
  )
}
