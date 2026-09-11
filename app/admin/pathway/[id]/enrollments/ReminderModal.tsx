"use client"

import { useState, useTransition } from "react"
import { X, Trash2, Bell } from "lucide-react"
import {
  adminAddEnrollmentReminder,
  adminAddCohortReminder,
  adminDeleteReminder,
} from "../../actions"

export type ReminderItem = {
  id: string
  scheduledAt: Date
  message: string | null
  sentAt: Date | null
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h).padStart(2, "0"),
  label: new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
}))

function formatReminder(d: Date) {
  return new Date(d).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

export function ReminderModal({
  pathwayId,
  target,
  reminders,
  onClose,
}: {
  pathwayId: string
  target: { kind: "enrollment" | "cohort"; id: string; label: string }
  reminders: ReminderItem[]
  onClose: () => void
}) {
  const [date, setDate] = useState("")
  const [hour, setHour] = useState("09")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    setError("")
    if (!date) {
      setError("Pick a date.")
      return
    }
    const [y, m, d] = date.split("-").map(Number)
    const scheduledAt = new Date(y, m - 1, d, Number(hour), 0, 0, 0)
    if (scheduledAt.getTime() <= Date.now()) {
      setError("Reminder time must be in the future.")
      return
    }

    startTransition(async () => {
      try {
        if (target.kind === "enrollment") {
          await adminAddEnrollmentReminder(target.id, pathwayId, scheduledAt, message.trim())
        } else {
          await adminAddCohortReminder(target.id, pathwayId, scheduledAt, message.trim())
        }
        setDate("")
        setMessage("")
      } catch (err: any) {
        setError(err.message ?? "Failed to add reminder.")
      }
    })
  }

  function handleDelete(reminderId: string) {
    startTransition(async () => {
      await adminDeleteReminder(reminderId, pathwayId)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ maxHeight: "85vh" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reminders</h2>
            <p className="text-xs text-slate-500">{target.label}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {reminders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No reminders scheduled yet.</p>
          ) : (
            <ul className="mb-5 flex flex-col gap-2">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <Bell size={13} className="shrink-0 text-slate-400" />
                      {formatReminder(r.scheduledAt)}
                      {r.sentAt && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Sent</span>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{r.message || "Random cheerful message"}</p>
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => handleDelete(r.id)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-medium text-slate-800">Add a reminder</p>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Time</label>
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {HOURS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Message <span className="text-slate-400">(optional — random cheerful message if left blank)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
            <button
              disabled={pending}
              onClick={handleAdd}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add Reminder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
