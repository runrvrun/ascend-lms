"use client"

import { useTransition } from "react"
import { Star, MessageSquare } from "lucide-react"
import { toggleCourseFeedback } from "../actions"

type FeedbackRow = {
  id: string
  rating: number
  comment: string | null
  createdAt: Date
  user: { name: string | null }
}

export function FeedbackSection({
  courseId,
  feedbackEnabled,
  feedbacks,
}: {
  courseId: string
  feedbackEnabled: boolean
  feedbacks: FeedbackRow[]
}) {
  const [pending, startTransition] = useTransition()

  const avg = feedbacks.length
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Feedback</h2>
          {avg && (
            <p className="mt-0.5 text-sm text-slate-500">
              Average rating: <span className="font-semibold text-slate-700">{avg} / 5</span> from {feedbacks.length} response{feedbacks.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          disabled={pending}
          onClick={() => startTransition(() => toggleCourseFeedback(courseId, !feedbackEnabled))}
          className="flex items-center gap-2 disabled:opacity-50"
          title={feedbackEnabled ? "Feedback enabled — click to disable" : "Feedback disabled — click to enable"}
        >
          <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${feedbackEnabled ? "bg-green-500" : "bg-slate-300"}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${feedbackEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </div>
          <span className={`text-xs font-medium ${feedbackEnabled ? "text-green-700" : "text-slate-400"}`}>
            {pending ? "…" : feedbackEnabled ? "Enabled" : "Disabled"}
          </span>
        </button>
      </div>

      {feedbacks.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No feedback received yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {feedbacks.map((f) => (
            <div key={f.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{f.user.name ?? "Unknown"}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      className={i < f.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}
                    />
                  ))}
                </div>
              </div>
              {f.comment && (
                <div className="flex items-start gap-1.5 mt-1">
                  <MessageSquare size={12} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="text-xs text-slate-600">{f.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
