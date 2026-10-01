"use client"

// Course progress tracker shared by the user progress page and the course report.
import { useState } from "react"
import { CheckCircle2, Circle, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react"
import type { CourseDetail } from "../lib/userLearningProgress"

export function StatusBadge({
  label,
  status,
}: {
  label?: string
  status: "PASSED" | "FAILED" | "SUBMITTED" | "PENDING"
}) {
  const text =
    status === "PASSED"
      ? "passed"
      : status === "FAILED"
      ? "failed"
      : status === "SUBMITTED"
      ? "awaiting review"
      : "not started"
  const cls =
    status === "PASSED"
      ? "bg-green-100 text-green-700"
      : status === "FAILED"
      ? "bg-red-100 text-red-700"
      : status === "SUBMITTED"
      ? "bg-orange-100 text-orange-700"
      : "bg-slate-100 text-slate-500"

  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label ? `${label} ${text}` : text.charAt(0).toUpperCase() + text.slice(1)}
    </span>
  )
}

export function RequirementIcon({ status }: { status: "PASSED" | "FAILED" | "SUBMITTED" | "PENDING" }) {
  if (status === "PASSED") return <CheckCircle2 size={12} className="shrink-0 text-green-500" />
  if (status === "FAILED") return <XCircle size={12} className="shrink-0 text-red-500" />
  if (status === "SUBMITTED") return <Clock size={12} className="shrink-0 text-orange-500" />
  return <Circle size={12} className="shrink-0 text-slate-300" />
}

export function CourseRow({ course }: { course: CourseDetail }) {
  const [open, setOpen] = useState(false)
  const hasExpandable = course.totalContents > 0 || course.tests.length > 0 || course.hasAssignment

  return (
    <div className="rounded-lg border border-slate-100 bg-white">
      <button
        onClick={() => hasExpandable && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
          hasExpandable ? "hover:bg-slate-50" : "cursor-default"
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {hasExpandable ? (
            open ? (
              <ChevronDown size={13} className="shrink-0 text-slate-400" />
            ) : (
              <ChevronRight size={13} className="shrink-0 text-slate-400" />
            )
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          {course.completed ? (
            <CheckCircle2 size={14} className="shrink-0 text-green-500" />
          ) : (
            <Circle size={14} className="shrink-0 text-slate-300" />
          )}
          <span className="truncate text-sm text-slate-700">{course.name}</span>
        </div>
        {course.totalContents > 0 && (
          <span className="shrink-0 text-xs text-slate-400">
            {course.completedContents}/{course.totalContents} lessons
          </span>
        )}
      </button>

      {open && hasExpandable && <CourseProgressDetail course={course} />}
    </div>
  )
}

// Per-lesson / per-test / assignment breakdown for one course.
export function CourseProgressDetail({ course, className = "" }: { course: CourseDetail; className?: string }) {
  return (
    <div className={`divide-y divide-slate-50 border-t border-slate-100 bg-slate-50/60 px-3 py-1 ${className}`}>
      {course.contents.map((content) => (
        <div key={content.id} className="flex items-center justify-between gap-3 py-1.5 pl-5">
          <div className="flex min-w-0 items-center gap-2">
            {content.completed ? (
              <CheckCircle2 size={12} className="shrink-0 text-green-500" />
            ) : (
              <Circle size={12} className="shrink-0 text-slate-300" />
            )}
            <span className="truncate text-xs text-slate-600">{content.title}</span>
          </div>
          {content.completedAt && (
            <span className="shrink-0 text-[11px] text-slate-400">
              {new Date(content.completedAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      ))}
      {course.tests.map((test) => (
        <div key={test.id} className="flex items-center justify-between gap-3 py-1.5 pl-5">
          <div className="flex min-w-0 items-center gap-2">
            <RequirementIcon status={test.status ?? "PENDING"} />
            <span className="truncate text-xs text-slate-600">{test.title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {test.score != null && (
              <span className="text-[11px] text-slate-400">{Math.round(test.score)}%</span>
            )}
            <StatusBadge status={test.status ?? "PENDING"} />
          </div>
        </div>
      ))}
      {course.hasAssignment && (
        <div className="flex items-center justify-between gap-3 py-1.5 pl-5">
          <div className="flex min-w-0 items-center gap-2">
            <RequirementIcon status={course.assignmentStatus ?? "PENDING"} />
            <span className="truncate text-xs text-slate-600">Assignment</span>
          </div>
          <StatusBadge status={course.assignmentStatus ?? "PENDING"} />
        </div>
      )}
    </div>
  )
}

