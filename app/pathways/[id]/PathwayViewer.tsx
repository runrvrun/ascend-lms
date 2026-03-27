"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Link2,
  Video,
  ClipboardList,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  Trophy,
  ChevronUp,
  GripVertical,
  Star,
  MessageSquare,
} from "lucide-react"
import { ContentType, SubmissionStatus } from "@prisma/client"
import { toggleContentComplete, submitTest, submitAssignment, submitCourseFeedback } from "../actions"
import { ContentDiscussion } from "../../components/ContentDiscussion"
import { VideoPlayer } from "./VideoPlayer"

type ContentItem = {
  id: string
  title: string
  type: ContentType
  value: string
  order: number
  duration: number | null
}

type QuestionOption = {
  id: string
  text: string
  isCorrect: boolean | null
  matchKey: string | null
  order: number | null
}

type Question = {
  id: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "RANKING" | "MATCHING"
  question: string
  order: number
  options: QuestionOption[]
}

type TestItem = {
  id: string
  passThreshold: number
  questions: Question[]
} | null

type AssignmentItem = {
  id: string
  description: string
  submitUrl: string
} | null

type SubmissionItem = {
  id: string
  assignmentId: string
  submissionUrl: string
  grade: number | null
  status: SubmissionStatus
  adminNote: string | null
  createdAt: Date
} | null

type CourseEntry = {
  order: number
  course: {
    id: string
    name: string
    contents: ContentItem[]
    test: TestItem
    assignment: AssignmentItem
    feedbackEnabled: boolean
  }
}

type PathwayData = {
  id: string
  name: string
  description: string | null
  courses: CourseEntry[]
}

type Selection =
  | { kind: "content"; content: ContentItem; courseId: string }
  | { kind: "test"; test: NonNullable<TestItem>; courseId: string; courseName: string }
  | { kind: "assignment"; assignment: NonNullable<AssignmentItem>; courseId: string; courseName: string }
  | { kind: "feedback"; courseId: string; courseName: string }

type TestResult = {
  score: number
  passed: boolean
  passThreshold: number
  correct: number
  total: number
  courseCompleted: boolean
  wrongAnswers: { question: string; userAnswer: string; correctAnswer: string }[]
}


// ─── Ranking question ────────────────────────────────────────────────────────

function RankingInput({
  options,
  value,
  onChange,
}: {
  options: QuestionOption[]
  value: string[]
  onChange: (val: string[]) => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const optMap = Object.fromEntries(options.map((o) => [o.id, o.text]))

  function move(idx: number, dir: -1 | 1) {
    const next = [...value]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  function onDragStart(idx: number) {
    setDragIdx(idx)
  }

  function onDragEnter(idx: number) {
    if (dragIdx === null || dragIdx === idx) return
    setOverIdx(idx)
    const next = [...value]
    const [item] = next.splice(dragIdx, 1)
    next.splice(idx, 0, item)
    setDragIdx(idx)
    onChange(next)
  }

  function onDragEnd() {
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500 mb-1">
        Drag items to reorder, or use the arrow buttons.
      </p>
      {value.map((id, idx) => (
        <div
          key={id}
          draggable
          onDragStart={() => onDragStart(idx)}
          onDragEnter={() => onDragEnter(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={onDragEnd}
          className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-3 transition-all select-none ${
            dragIdx === idx
              ? "opacity-50 border-blue-400 shadow-md scale-[1.02]"
              : overIdx === idx
              ? "border-blue-300 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          {/* Drag handle */}
          <GripVertical size={16} className="shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" />

          {/* Position badge */}
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
            {idx + 1}
          </span>

          {/* Label */}
          <span className="flex-1 text-sm text-slate-700">{optMap[id]}</span>

          {/* Arrow buttons */}
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === value.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Matching question ───────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function MatchingInput({
  options,
  value,
  onChange,
}: {
  options: QuestionOption[]
  value: string
  onChange: (val: string) => void
}) {
  const [shuffledOptions] = useState(() => shuffle(options))
  const [shuffledKeys] = useState(() =>
    shuffle([...new Set(options.map((o) => o.matchKey).filter(Boolean))] as string[])
  )

  const current: Record<string, string> = (() => {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  })()

  function updateMatch(optId: string, mk: string) {
    onChange(JSON.stringify({ ...current, [optId]: mk }))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">Match each item on the left to the correct option on the right.</p>
      {shuffledOptions.map((opt) => (
        <div key={opt.id} className="flex items-center gap-3">
          <span className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{opt.text}</span>
          <span className="text-slate-400 text-xs">→</span>
          <select
            value={current[opt.id] ?? ""}
            onChange={(e) => updateMatch(opt.id, e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select…</option>
            {shuffledKeys.map((mk) => (
              <option key={mk} value={mk}>
                {mk}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

// ─── Single question renderer ─────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  answer,
  onChange,
}: {
  question: Question
  index: number
  answer: string | string[] | undefined
  onChange: (val: string | string[]) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <p className="mb-4 font-medium text-slate-900">
        <span className="mr-2 text-slate-400">{index + 1}.</span>
        {question.question}
      </p>

      {(question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE") && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
            >
              <input
                type="radio"
                name={question.id}
                value={opt.id}
                checked={answer === opt.id}
                onChange={() => onChange(opt.id)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-slate-700">{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === "FILL_BLANK" && (
        <input
          type="text"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}

      {question.type === "RANKING" && (
        <RankingInput
          options={question.options}
          value={Array.isArray(answer) ? answer : question.options.map((o) => o.id)}
          onChange={onChange}
        />
      )}

      {question.type === "MATCHING" && (
        <MatchingInput
          options={question.options}
          value={typeof answer === "string" ? answer : "{}"}
          onChange={onChange}
        />
      )}
    </div>
  )
}

// ─── Test viewer ──────────────────────────────────────────────────────────────

function TestViewer({
  test,
  courseId,
  pathwayId,
  courseName,
  isAlreadyPassed,
}: {
  test: NonNullable<TestItem>
  courseId: string
  pathwayId: string
  courseName: string
  isAlreadyPassed: boolean
}) {
  const [phase, setPhase] = useState<"idle" | "taking" | "result">("idle")
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [result, setResult] = useState<TestResult | null>(null)
  const [pending, startTransition] = useTransition()

  function initAnswers() {
    const init: Record<string, string | string[]> = {}
    test.questions.forEach((q) => {
      if (q.type === "RANKING") {
        const ids = q.options.map((o) => o.id)
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[ids[i], ids[j]] = [ids[j], ids[i]]
        }
        init[q.id] = ids
      }
    })
    return init
  }

  function handleStart() {
    setAnswers(initAnswers())
    setPhase("taking")
  }

  function handleRetry() {
    setAnswers(initAnswers())
    setResult(null)
    setPhase("taking")
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitTest(test.id, courseId, pathwayId, answers)
      setResult(res)
      setPhase("result")
    })
  }

  const canSubmit = test.questions.every((q) => {
    const a = answers[q.id]
    if (a === undefined) return false
    if (q.type === "MATCHING") {
      try {
        const m = JSON.parse(a as string)
        return q.options.every((o) => m[o.id])
      } catch {
        return false
      }
    }
    if (q.type === "FILL_BLANK") return typeof a === "string" && a.trim() !== ""
    if (q.type === "RANKING") return Array.isArray(a) && a.length === q.options.length
    return typeof a === "string" && a !== ""
  })

  // ── Idle phase ─────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            isAlreadyPassed ? "bg-green-100" : "bg-blue-100"
          }`}
        >
          {isAlreadyPassed ? (
            <CheckCircle2 size={28} className="text-green-600" />
          ) : (
            <ClipboardList size={26} className="text-blue-600" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{courseName} — Test</h2>
          <p className="mt-1 text-sm text-slate-500">
            {test.questions.length} question{test.questions.length !== 1 ? "s" : ""} · Pass:{" "}
            {test.passThreshold}%
          </p>
        </div>
        {isAlreadyPassed ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-100 px-5 py-2.5 text-sm font-semibold text-green-700">
            <CheckCircle2 size={15} />
            Test Passed
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Start Test
          </button>
        )}
        {isAlreadyPassed && (
          <button
            onClick={handleStart}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Retake test
          </button>
        )}
      </div>
    )
  }

  // ── Result phase ───────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    return (
      <div className="h-full overflow-y-auto p-6 md:p-8">
        {/* Score summary */}
        <div className="flex flex-col items-center text-center gap-4 mb-8">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              result.passed ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {result.passed ? (
              <CheckCircle2 size={32} className="text-green-600" />
            ) : (
              <XCircle size={32} className="text-red-500" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {result.passed ? "You Passed!" : "Not Quite"}
            </h2>
            <p className="mt-1 text-slate-500">
              {result.correct} of {result.total} correct
            </p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span
              className={`text-5xl font-bold ${result.passed ? "text-green-600" : "text-red-500"}`}
            >
              {result.score}%
            </span>
            <span className="text-sm text-slate-500">Pass threshold: {result.passThreshold}%</span>
          </div>

          {result.passed ? (
            <div className="rounded-xl bg-green-50 px-5 py-3 text-sm text-green-700">
              {result.courseCompleted
                ? "This course has been marked as completed."
                : "Test passed! Complete all remaining requirements to finish the course."}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-slate-500">
                You need {result.passThreshold}% to pass. You can reattempt as many times as you like.
              </p>
              <button
                onClick={handleRetry}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Wrong answers review */}
        {result.wrongAnswers.length > 0 && (
          <div className="mx-auto max-w-2xl">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Questions to Review ({result.wrongAnswers.length})
            </h3>
            <div className="flex flex-col gap-3">
              {result.wrongAnswers.map((w, i) => (
                <div key={i} className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-800">{w.question}</p>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <div className="flex gap-2">
                      <span className="shrink-0 font-medium text-red-500">Your answer:</span>
                      <span className="text-slate-600">{w.userAnswer}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="shrink-0 font-medium text-green-600">Correct answer:</span>
                      <span className="text-slate-700 font-medium">{w.correctAnswer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {result.passed && (
              <button
                onClick={handleRetry}
                className="mt-5 rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Retake to improve your score
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Taking phase ───────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">{courseName} — Test</h2>
        <p className="mt-1 text-sm text-slate-500">
          {test.questions.length} question{test.questions.length !== 1 ? "s" : ""} · Pass:{" "}
          {test.passThreshold}%
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {test.questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={idx}
            answer={answers[q.id]}
            onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
          />
        ))}
      </div>

      <div className="mt-8">
        <button
          disabled={pending || !canSubmit}
          onClick={handleSubmit}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit Test"}
        </button>
      </div>
    </div>
  )
}

// ─── Assignment viewer ────────────────────────────────────────────────────────

function AssignmentViewer({
  assignment,
  courseId,
  pathwayId,
  courseName,
  submission,
  isAlreadyPassed,
}: {
  assignment: NonNullable<AssignmentItem>
  courseId: string
  pathwayId: string
  courseName: string
  submission: SubmissionItem
  isAlreadyPassed: boolean
}) {
  const [url, setUrl] = useState("")
  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await submitAssignment(assignment.id, pathwayId, url)
      setUrl("")
      setSubmitted(true)
    })
  }

  const status = submission?.status

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{courseName}</div>
      <h2 className="mb-6 text-xl font-bold text-slate-900">Assignment</h2>

      {/* Description */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-2">Instructions</p>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{assignment.description}</div>
      </div>

      {/* Submission link */}
      <div className="mb-6">
        <a
          href={assignment.submitUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          Open submission folder
          <ExternalLink size={11} />
        </a>
      </div>

      {/* Status banner */}
      {isAlreadyPassed && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-semibold text-green-700">
          <CheckCircle2 size={16} />
          Assignment passed — course completed!
        </div>
      )}

      {!isAlreadyPassed && status === "PASSED" && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-semibold text-green-700">
          <CheckCircle2 size={16} />
          Assignment passed — course completed!
        </div>
      )}

      {!isAlreadyPassed && status === "SUBMITTED" && !submitted && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
          <Clock size={15} />
          Your submission is pending review.
        </div>
      )}

      {!isAlreadyPassed && status === "FAILED" && !submitted && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-red-700 mb-1">
            <XCircle size={15} />
            Assignment failed — please resubmit.
          </div>
          {submission?.adminNote && (
            <p className="text-red-600 text-xs mt-1">Feedback: {submission.adminNote}</p>
          )}
        </div>
      )}

      {submitted && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-semibold text-green-700">
          <CheckCircle2 size={16} />
          Submission received! Your assignment is pending review.
        </div>
      )}

      {/* Submit form — hide if already passed */}
      {!isAlreadyPassed && status !== "PASSED" && !submitted && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            {status === "FAILED" ? "Resubmit your assignment" : "Submit your assignment"}
          </p>
          <p className="mb-4 text-xs text-slate-500">
            Upload your file to the submission folder above, then paste the link to your submitted file below.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ycphd.sharepoint.com/…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Submitting…" : status === "FAILED" ? "Resubmit" : "Submit Assignment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Content viewer ───────────────────────────────────────────────────────────

const TYPE_ICON: Record<ContentType, React.ReactNode> = {
  TEXT: <FileText size={13} />,
  VIDEO: <Video size={13} />,
  LINK: <Link2 size={13} />,
}

function FeedbackViewer({
  courseId,
  pathwayId,
  courseName,
  courseCompleted,
  existing,
}: {
  courseId: string
  pathwayId: string
  courseName: string
  courseCompleted: boolean
  existing: { rating: number; comment: string | null } | null
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState(existing?.comment ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    startTransition(async () => {
      await submitCourseFeedback(courseId, pathwayId, rating, comment)
      setSubmitted(true)
    })
  }

  const displayRating = hovered || rating

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{courseName}</div>
      <h2 className="mb-6 text-xl font-bold text-slate-900">Course Feedback</h2>

      {!courseCompleted ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <Star size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Complete the course to leave feedback.</p>
        </div>
      ) : submitted || (existing && !submitted) ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-700">
              {submitted ? "Feedback submitted!" : "You've already submitted feedback."}
            </span>
          </div>
          <div className="flex items-center gap-0.5 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={18} className={i < (submitted ? rating : existing!.rating) ? "fill-yellow-400 text-yellow-400" : "text-slate-300"} />
            ))}
          </div>
          {(submitted ? comment : existing!.comment) && (
            <p className="text-sm text-slate-600">{submitted ? comment : existing!.comment}</p>
          )}
          {!submitted && (
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Edit feedback
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Rating <span className="text-red-500">*</span></p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i + 1)}
                  onMouseEnter={() => setHovered(i + 1)}
                  onMouseLeave={() => setHovered(0)}
                  className="focus:outline-none"
                >
                  <Star
                    size={28}
                    className={i < displayRating ? "fill-yellow-400 text-yellow-400" : "text-slate-300 hover:text-yellow-300"}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-slate-500">{rating} / 5</span>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Comments <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts on this course or trainer…"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={!rating || pending}
            className="self-start rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit Feedback"}
          </button>
        </form>
      )}
    </div>
  )
}

function ContentViewer({
  selection,
  pathwayId,
  completedContentIds,
  completedCourseIds,
  currentUserId,
  latestSubmissionByAssignmentId,
  testStatusByCourseId,
  assignmentStatusByCourseId,
  feedbackByCourseId,
}: {
  selection: Selection | null
  pathwayId: string
  completedContentIds: Set<string>
  completedCourseIds: Set<string>
  currentUserId: string
  latestSubmissionByAssignmentId: Record<string, SubmissionItem>
  testStatusByCourseId: Record<string, "PASSED" | "FAILED">
  assignmentStatusByCourseId: Record<string, "PASSED" | "FAILED">
  feedbackByCourseId: Record<string, { rating: number; comment: string | null }>
}) {
  const [pending, startTransition] = useTransition()
  const [videoProgress, setVideoProgress] = useState(0)
  const contentId = selection?.kind === "content" ? selection.content.id : null
  const prevContentIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (contentId !== prevContentIdRef.current) {
      prevContentIdRef.current = contentId
      setVideoProgress(0)
    }
  }, [contentId])

  function CompleteButton({ contentId, videoGated = false }: { contentId: string; videoGated?: boolean }) {
    const done = completedContentIds.has(contentId)
    const notReady = videoGated && !done && videoProgress < 0.75
    return (
      <div className="flex flex-col gap-1.5">
        <button
          disabled={pending || notReady}
          onClick={() =>
            startTransition(() => toggleContentComplete(contentId, pathwayId, !done))
          }
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            done
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : notReady
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          {done ? "Completed" : pending ? "Marking as Completed…" : "Mark as Completed"}
        </button>
        {notReady && (
          <p className="text-xs text-slate-400">
            Watch at least 75% to unlock — {Math.round(videoProgress * 100)}% watched
          </p>
        )}
      </div>
    )
  }

  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        Select a content item from the left to begin.
      </div>
    )
  }

  if (selection.kind === "test") {
    return (
      <TestViewer
        test={selection.test}
        courseId={selection.courseId}
        pathwayId={pathwayId}
        courseName={selection.courseName}
        isAlreadyPassed={testStatusByCourseId[selection.courseId] === "PASSED"}
      />
    )
  }

  if (selection.kind === "assignment") {
    return (
      <AssignmentViewer
        assignment={selection.assignment}
        courseId={selection.courseId}
        pathwayId={pathwayId}
        courseName={selection.courseName}
        submission={latestSubmissionByAssignmentId[selection.assignment.id] ?? null}
        isAlreadyPassed={assignmentStatusByCourseId[selection.courseId] === "PASSED"}
      />
    )
  }

  if (selection.kind === "feedback") {
    return (
      <FeedbackViewer
        courseId={selection.courseId}
        pathwayId={pathwayId}
        courseName={selection.courseName}
        courseCompleted={completedCourseIds.has(selection.courseId)}
        existing={feedbackByCourseId[selection.courseId] ?? null}
      />
    )
  }

  const { content } = selection

  if (content.type === "TEXT") {
    return (
      <div className="h-full overflow-y-auto p-6 md:p-8">
        <h2 className="mb-4 text-xl font-bold text-slate-900">{content.title}</h2>
        <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {content.value}
        </div>
        <div className="mt-8">
          <CompleteButton contentId={content.id} />
        </div>
        <ContentDiscussion contentId={content.id} pathwayId={pathwayId} currentUserId={currentUserId} />
      </div>
    )
  }

  if (content.type === "VIDEO") {
    return (
      <div className="h-full overflow-y-auto p-6 md:p-8">
        <h2 className="mb-4 text-xl font-bold text-slate-900">{content.title}</h2>
        <VideoPlayer key={content.id} url={content.value} duration={content.duration ?? undefined} onProgress={setVideoProgress} />
        <div className="mt-6">
          <CompleteButton contentId={content.id} videoGated />
        </div>
        <ContentDiscussion contentId={content.id} pathwayId={pathwayId} currentUserId={currentUserId} />
      </div>
    )
  }

  // LINK
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Link2 size={26} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{content.title}</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500 break-all">{content.value}</p>
        </div>
        <a
          href={content.value}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Open Link
          <ExternalLink size={14} />
        </a>
        <CompleteButton contentId={content.id} />
      </div>
      <ContentDiscussion contentId={content.id} pathwayId={pathwayId} currentUserId={currentUserId} />
    </div>
  )
}

// ─── Course section (sidebar) ─────────────────────────────────────────────────

function CourseSection({
  entry,
  selectedId,
  completedContentIds,
  completedCourseIds,
  testStatusByCourseId,
  assignmentStatusByCourseId,
  feedbackByCourseId,
  onSelect,
}: {
  entry: CourseEntry
  selectedId: string | null
  completedContentIds: Set<string>
  completedCourseIds: Set<string>
  testStatusByCourseId: Record<string, "PASSED" | "FAILED">
  assignmentStatusByCourseId: Record<string, "PASSED" | "FAILED">
  feedbackByCourseId: Record<string, { rating: number; comment: string | null }>
  onSelect: (sel: Selection) => void
}) {
  const [open, setOpen] = useState(true)
  const { course } = entry
  const courseCompleted = completedCourseIds.has(course.id)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-100"
      >
        {open ? (
          <ChevronDown size={13} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-slate-400" />
        )}
        {courseCompleted ? (
          <CheckCircle2 size={13} className="shrink-0 text-green-500" />
        ) : (
          <BookOpen size={13} className="shrink-0 text-blue-500" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 truncate">
          {course.name}
        </span>
      </button>

      {open && (
        <div className="pb-1">
          {course.contents.map((c) => {
            const active = selectedId === c.id
            const done = completedContentIds.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => onSelect({ kind: "content", content: c, courseId: course.id })}
                className={`flex w-full items-center gap-2 pl-9 pr-4 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {done ? (
                  <CheckCircle2 size={13} className="shrink-0 text-green-500" />
                ) : (
                  <span className={active ? "text-blue-500" : "text-slate-400"}>
                    {TYPE_ICON[c.type]}
                  </span>
                )}
                <span className="truncate">{c.title}</span>
              </button>
            )
          })}

          {course.test && (
            <button
              onClick={() =>
                onSelect({
                  kind: "test",
                  test: course.test!,
                  courseId: course.id,
                  courseName: course.name,
                })
              }
              className={`flex w-full items-center gap-2 pl-9 pr-4 py-2 text-left text-sm transition-colors ${
                selectedId === `test-${course.test.id}`
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {testStatusByCourseId[course.id] === "PASSED" ? (
                <CheckCircle2 size={13} className="shrink-0 text-green-500" />
              ) : (
                <span
                  className={
                    selectedId === `test-${course.test.id}` ? "text-blue-500" : "text-slate-400"
                  }
                >
                  <ClipboardList size={13} />
                </span>
              )}
              <span className="truncate">Test</span>
            </button>
          )}

          {course.assignment && (
            <button
              onClick={() =>
                onSelect({
                  kind: "assignment",
                  assignment: course.assignment!,
                  courseId: course.id,
                  courseName: course.name,
                })
              }
              className={`flex w-full items-center gap-2 pl-9 pr-4 py-2 text-left text-sm transition-colors ${
                selectedId === `assignment-${course.assignment.id}`
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {assignmentStatusByCourseId[course.id] === "PASSED" ? (
                <CheckCircle2 size={13} className="shrink-0 text-green-500" />
              ) : (
                <span
                  className={
                    selectedId === `assignment-${course.assignment.id}` ? "text-blue-500" : "text-slate-400"
                  }
                >
                  <ClipboardCheck size={13} />
                </span>
              )}
              <span className="truncate">Assignment</span>
            </button>
          )}

          {course.feedbackEnabled && (
            <button
              onClick={() => onSelect({ kind: "feedback", courseId: course.id, courseName: course.name })}
              className={`flex w-full items-center gap-2 pl-9 pr-4 py-2 text-left text-sm transition-colors ${
                selectedId === `feedback-${course.id}`
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {feedbackByCourseId[course.id] ? (
                <CheckCircle2 size={13} className="shrink-0 text-green-500" />
              ) : (
                <span className={selectedId === `feedback-${course.id}` ? "text-blue-500" : "text-slate-400"}>
                  <Star size={13} />
                </span>
              )}
              <span className="truncate">Feedback</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pathway viewer (root) ────────────────────────────────────────────────────

export function PathwayViewer({
  pathway,
  completedContentIds,
  completedCourseIds,
  isPathwayComplete,
  currentUserId,
  latestSubmissionByAssignmentId,
  testStatusByCourseId,
  assignmentStatusByCourseId,
  feedbackByCourseId,
}: {
  pathway: PathwayData
  completedContentIds: Set<string>
  completedCourseIds: Set<string>
  isPathwayComplete: boolean
  currentUserId: string
  latestSubmissionByAssignmentId: Record<string, SubmissionItem>
  testStatusByCourseId: Record<string, "PASSED" | "FAILED">
  assignmentStatusByCourseId: Record<string, "PASSED" | "FAILED">
  feedbackByCourseId: Record<string, { rating: number; comment: string | null }>
}) {
  const firstCourse = pathway.courses[0]?.course
  const firstContent = firstCourse?.contents[0]
  const [selected, setSelected] = useState<Selection | null>(
    firstContent
      ? { kind: "content", content: firstContent, courseId: firstCourse!.id }
      : null
  )

  const selectedId =
    selected?.kind === "content"
      ? selected.content.id
      : selected?.kind === "test"
      ? `test-${selected.test.id}`
      : selected?.kind === "assignment"
      ? `assignment-${selected.assignment.id}`
      : selected?.kind === "feedback"
      ? `feedback-${selected.courseId}`
      : null

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
        <a href="/pathways" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} />
          Pathways
        </a>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800 truncate">{pathway.name}</span>
        {isPathwayComplete && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            <Trophy size={12} />
            Completed
          </span>
        )}
      </div>

      {/* Completion banner */}
      {isPathwayComplete && (
        <div className="flex shrink-0 items-center justify-center gap-3 bg-green-600 px-4 py-2 text-sm font-semibold text-white">
          <Trophy size={15} />
          Congratulations! You have completed the {pathway.name} pathway.
          <a
            href={`/pathways/${pathway.id}/certificate`}
            className="ml-2 flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs hover:bg-white/30"
          >
            View Certificate →
          </a>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contents</p>
          </div>
          <div className="divide-y divide-slate-100">
            {pathway.courses.map((entry) => (
              <CourseSection
                key={entry.course.id}
                entry={entry}
                selectedId={selectedId}
                completedContentIds={completedContentIds}
                completedCourseIds={completedCourseIds}
                testStatusByCourseId={testStatusByCourseId}
                assignmentStatusByCourseId={assignmentStatusByCourseId}
                feedbackByCourseId={feedbackByCourseId}
                onSelect={setSelected}
              />
            ))}
          </div>
        </aside>

        {/* Right content area */}
        <main className="flex-1 overflow-hidden bg-white">
          <ContentViewer
            selection={selected}
            pathwayId={pathway.id}
            completedContentIds={completedContentIds}
            completedCourseIds={completedCourseIds}
            currentUserId={currentUserId}
            latestSubmissionByAssignmentId={latestSubmissionByAssignmentId}
            testStatusByCourseId={testStatusByCourseId}
            assignmentStatusByCourseId={assignmentStatusByCourseId}
            feedbackByCourseId={feedbackByCourseId}
          />
        </main>
      </div>
    </div>
  )
}
