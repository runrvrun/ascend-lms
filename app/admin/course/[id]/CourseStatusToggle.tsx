"use client"

import { useTransition } from "react"
import { toggleCourseStatus } from "../actions"

export function CourseStatusToggle({ id, status }: { id: string; status: "DRAFT" | "PUBLISHED" }) {
  const [pending, startTransition] = useTransition()
  const isOn = status === "PUBLISHED"
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleCourseStatus(id, isOn ? "DRAFT" : "PUBLISHED"))}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm disabled:opacity-50 hover:bg-slate-50"
      title={isOn ? "Published — click to set Draft" : "Draft — click to Publish"}
    >
      <div className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${isOn ? "bg-green-500" : "bg-slate-300"}`}>
        <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${isOn ? "translate-x-[14px]" : "translate-x-0.5"}`} />
      </div>
      <span className={isOn ? "text-green-700" : "text-slate-400"}>
        {pending ? "…" : isOn ? "Published" : "Draft"}
      </span>
    </button>
  )
}
