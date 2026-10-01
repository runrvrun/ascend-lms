"use client"

import { useState, useTransition } from "react"
import { updateEmailReminderPreference } from "./actions"

export function NotificationSettings({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !optIn
    setOptIn(next)
    startTransition(() => updateEmailReminderPreference(next))
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800">Learning reminder emails</p>
        <p className="text-sm text-slate-500">
          Get a weekly reminder email (Wednesdays) if you have pathways left to finish.
        </p>
      </div>
      <button
        disabled={pending}
        onClick={toggle}
        className="flex items-center gap-2 disabled:opacity-50"
        title={optIn ? "Enabled — click to disable" : "Disabled — click to enable"}
      >
        <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${optIn ? "bg-green-500" : "bg-slate-300"}`}>
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${optIn ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </div>
        <span className={`text-xs font-medium ${optIn ? "text-green-700" : "text-slate-400"}`}>
          {pending ? "…" : optIn ? "Enabled" : "Disabled"}
        </span>
      </button>
    </div>
  )
}
