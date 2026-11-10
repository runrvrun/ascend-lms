"use client"

import { useState } from "react"

const TABS = [
  { key: "content", label: "Contents" },
  { key: "submissions", label: "Assignment Submissions" },
  { key: "feedback", label: "Feedbacks" },
] as const

type TabKey = typeof TABS[number]["key"]

export function CourseTabLayout({
  content,
  submissions,
  feedback,
}: {
  content: React.ReactNode
  submissions: React.ReactNode
  feedback: React.ReactNode
}) {
  const [tab, setTab] = useState<TabKey>("content")

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-4 ${
              tab === t.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "content" ? "" : "hidden"}>{content}</div>
      <div className={tab === "submissions" ? "" : "hidden"}>{submissions}</div>
      <div className={tab === "feedback" ? "" : "hidden"}>{feedback}</div>
    </div>
  )
}
