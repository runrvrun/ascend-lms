"use client"

import { useState, useTransition } from "react"
import { Search, RotateCw, Eye, X, Mail, ChevronLeft, ChevronRight } from "lucide-react"
import { resendEmail, resendAllFailed, getEmailHtml } from "./actions"

type EmailStatus = "PENDING" | "SENDING" | "SENT" | "FAILED"

type EmailRow = {
  id: string
  to: string
  subject: string
  status: EmailStatus
  bulk: boolean
  attempts: number
  nextAttemptAt: string
  sentAt: string | null
  lastError: string | null
  createdAt: string
}

const STATUS_STYLE: Record<EmailStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  SENDING: "bg-blue-50 text-blue-700",
  SENT: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
}

const STATUS_LABEL: Record<EmailStatus, string> = {
  PENDING: "Queued",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
}

// Shown in the viewer's own time zone.
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

function pageHref(filters: { q: string; status: string }, page: number) {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.status) params.set("status", filters.status)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `/admin/email?${qs}` : "/admin/email"
}

function PreviewModal({ email, html, onClose }: { email: EmailRow; html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{email.subject}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">To {email.to}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {/* Sandboxed: the stored HTML is rendered with no scripts and no access to this page. */}
        <iframe title="Email preview" sandbox="" srcDoc={html} className="w-full flex-1 rounded-b-2xl" />
      </div>
    </div>
  )
}

function ResendButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await resendEmail(id) })}
      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      <RotateCw size={12} className={pending ? "animate-spin" : ""} />
      Resend
    </button>
  )
}

export function EmailLog({
  emails,
  counts,
  sentLastDay,
  dailyLimit,
  filters,
  page,
  pageCount,
  total,
}: {
  emails: EmailRow[]
  counts: Record<EmailStatus, number>
  sentLastDay: number
  dailyLimit: number
  filters: { q: string; status: string }
  page: number
  pageCount: number
  total: number
}) {
  const [previewing, setPreviewing] = useState<{ email: EmailRow; html: string } | null>(null)
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null)
  const [resendingAll, startResendAll] = useTransition()

  async function openPreview(email: EmailRow) {
    setLoadingPreviewId(email.id)
    const html = (await getEmailHtml(email.id)) ?? "<p>Email not found.</p>"
    setLoadingPreviewId(null)
    setPreviewing({ email, html })
  }

  const stats = [
    { label: "Queued", value: counts.PENDING + counts.SENDING, style: "text-amber-600" },
    { label: "Sent in last 24 hours", value: `${sentLastDay.toLocaleString()} / ${dailyLimit.toLocaleString()}`, style: "text-green-600" },
    { label: "Failed", value: counts.FAILED, style: "text-red-600" },
    { label: "All emails", value: (counts.PENDING + counts.SENDING + counts.SENT + counts.FAILED).toLocaleString(), style: "text-slate-900" },
  ]

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every email Ascend sends, at most 20 a minute. Failed emails are retried automatically up to 5 times.
          </p>
        </div>
        {counts.FAILED > 0 && (
          <button
            disabled={resendingAll}
            onClick={() => startResendAll(async () => { await resendAllFailed() })}
            className="flex items-center gap-2 rounded-xl bg-[#194693] px-4 py-2 text-sm font-medium text-white hover:bg-[#03368C] disabled:opacity-50"
          >
            <RotateCw size={15} className={resendingAll ? "animate-spin" : ""} />
            Resend all failed ({counts.FAILED})
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className={`text-lg font-bold ${s.style}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Plain GET form: filters live in the URL so the page can be bookmarked or refreshed. */}
      <form action="/admin/email" className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search by recipient or subject…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          name="status"
          defaultValue={filters.status}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as EmailStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
          Filter
        </button>
      </form>

      {emails.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
          <Mail size={28} className="mx-auto mb-3 text-slate-300" />
          {filters.q || filters.status ? "No emails match these filters." : "No emails sent yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Queued</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-4 py-3 text-slate-700">{e.to}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-700">
                    <div className="truncate" title={e.subject}>{e.subject}</div>
                    {e.lastError && e.status !== "SENT" && (
                      <div className="mt-1 line-clamp-2 text-xs text-red-600" title={e.lastError}>{e.lastError}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                    {e.attempts > 1 && <div className="mt-1 text-xs text-slate-400">{e.attempts} attempts</div>}
                    {e.status === "PENDING" && e.attempts > 0 && (
                      <div className="mt-1 text-xs text-slate-400" suppressHydrationWarning>Retry {formatTime(e.nextAttemptAt)}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500" suppressHydrationWarning>{formatTime(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500" suppressHydrationWarning>
                    {e.sentAt ? formatTime(e.sentAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        disabled={loadingPreviewId === e.id}
                        onClick={() => openPreview(e)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Eye size={12} />
                        {loadingPreviewId === e.id ? "…" : "View"}
                      </button>
                      {e.status === "FAILED" && <ResendButton id={e.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total.toLocaleString()} emails · page {page} of {pageCount}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={pageHref(filters, page - 1)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                <ChevronLeft size={14} /> Newer
              </a>
            )}
            {page < pageCount && (
              <a href={pageHref(filters, page + 1)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                Older <ChevronRight size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {previewing && <PreviewModal email={previewing.email} html={previewing.html} onClose={() => setPreviewing(null)} />}
    </>
  )
}
