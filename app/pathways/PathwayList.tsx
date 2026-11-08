"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Search, X, CheckCircle2, Clock, XCircle, ArrowRight, LogOut, Sparkles, Eye, Share2, Star, Users, SlidersHorizontal, Check } from "lucide-react"
import type { EnrollmentStatus, Language, PathwayVisibility } from "@prisma/client"
import { LANGUAGES } from "../lib/languages"
import { enrollPathway, requestPathway, unenrollPathway } from "./actions"
import { SharePathwayModal } from "./SharePathwayModal"
import type { Recommendation, RecommendationKind } from "../lib/pathwayRecommendations"

const RECOMMENDATION_ICON: Record<RecommendationKind, React.ReactNode> = {
  featured: <Star size={13} fill="currentColor" className="shrink-0" />,
  popular: <Users size={13} className="shrink-0" />,
  next: <ArrowRight size={13} className="shrink-0" />,
  similar: <Sparkles size={13} className="shrink-0" />,
}

type EnrollmentInfo = {
  status: EnrollmentStatus
  note: string | null
  rejectionReason: string | null
}

type PathwayCard = {
  id: string
  name: string
  description: string | null
  visibility: PathwayVisibility
  tags: string[]
  isCompleted: boolean
  completedCourses: number
  totalCourses: number
  recommendation: Recommendation | null
  _count: { courses: number }
  enrollment: EnrollmentInfo | null
  createdAt: string // ISO
  enrollmentCount: number
  topicIds: string[]
  languages: Language[]
}

export type TopicFilterOption = { id: string; name: string; count: number }

export function RequestModal({
  pathway,
  onClose,
}: {
  pathway: { id: string; name: string }
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
  const [sharing, setSharing] = useState(false)
  const [unenrollConfirming, setUnenrollConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [unenrollPending, startUnenrollTransition] = useTransition()
  const { enrollment } = pathway

  function handleEnroll() {
    startTransition(async () => {
      await enrollPathway(pathway.id)
    })
  }

  function handleUnenroll() {
    startUnenrollTransition(async () => {
      await unenrollPathway(pathway.id)
    })
  }

  const enrollmentStatus = enrollment?.status
  const isEnrolled = enrollmentStatus === "APPROVED" || enrollmentStatus === "PENDING"

  function actionButton() {
    if (enrollmentStatus === "APPROVED") {
      return (
        <a
          href={`/pathways/${pathway.id}`}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          Go to Pathway
          <ArrowRight size={14} />
        </a>
      )
    }

    if (enrollmentStatus === "PENDING") {
      return (
        <button disabled className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-400 cursor-not-allowed">
          <Clock size={14} />
          Awaiting Approval
        </button>
      )
    }

    if (pathway.visibility === "PUBLIC_APPROVAL") {
      return (
        <button
          onClick={() => setRequesting(true)}
          className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Request Enrollment
        </button>
      )
    }

    return (
      <button
        onClick={handleEnroll}
        disabled={pending}
        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll"}
      </button>
    )
  }

  const featured = !!pathway.recommendation
  const percent = pathway.totalCourses > 0 ? Math.round((pathway.completedCourses / pathway.totalCourses) * 100) : 0
  const secondaryButton = "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium"

  const secondaryButtons = (
    <>
      {/* Icon-only on phones so the bottom row fits on one line. */}
      <button onClick={() => setSharing(true)} aria-label="Share" title="Share" className={`${secondaryButton} text-slate-600 hover:bg-slate-50`}>
        <Share2 size={12} />
        <span className="hidden sm:inline">Share</span>
      </button>

      {/* Only for pathways the learner hasn't joined or requested yet. */}
      {!isEnrolled && (
        <a href={`/pathways/${pathway.id}/preview`} className={`${secondaryButton} text-slate-600 hover:bg-slate-50`}>
          <Eye size={12} />
          Preview
        </a>
      )}

      {isEnrolled && (
        unenrollConfirming ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">{enrollmentStatus === "PENDING" ? "Cancel request?" : "Unenroll?"}</span>
            <button
              disabled={unenrollPending}
              onClick={handleUnenroll}
              className="rounded-lg px-2 py-1 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {unenrollPending ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setUnenrollConfirming(false)}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setUnenrollConfirming(true)}
            className={`${secondaryButton} text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
          >
            {enrollmentStatus === "PENDING" ? <X size={12} /> : <LogOut size={12} />}
            {enrollmentStatus === "PENDING" ? "Cancel" : "Unenroll"}
          </button>
        )
      )}
    </>
  )

  // Same three rows on every card:
  //   name (full width)
  //   badges + tags ............................ Share, Preview / Unenroll / Cancel
  //   course count + progress .................. Enroll / Go to Pathway
  // On phones all the buttons move to one row at the bottom instead.
  return (
    <>
      <div className={`rounded-xl border px-4 py-3 shadow-sm transition-shadow hover:shadow-md sm:px-5 ${featured ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
        <h3 className="font-semibold leading-snug text-slate-900" title={pathway.description ?? undefined}>{pathway.name}</h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs">
            {pathway.recommendation && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                {RECOMMENDATION_ICON[pathway.recommendation.kind]}
                {pathway.recommendation.label}
              </span>
            )}
            {pathway.visibility === "PUBLIC_APPROVAL" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Approval required</span>
            ) : (
              <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">Free enroll</span>
            )}
            {pathway.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{tag}</span>
            ))}
          </div>

          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">{secondaryButtons}</div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{pathway._count.courses} course{pathway._count.courses !== 1 ? "s" : ""}</span>
            {/* Progress — only for approved, in-progress enrollments */}
            {enrollment?.status === "APPROVED" && !pathway.isCompleted && pathway.totalCourses > 0 && (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-24 rounded-full bg-slate-200">
                  <span className="block h-1.5 rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
                </span>
                {pathway.completedCourses}/{pathway.totalCourses} courses done
              </span>
            )}
            {pathway.isCompleted && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                <CheckCircle2 size={11} />
                Completed
              </span>
            )}
          </div>

          <div className="ml-auto hidden shrink-0 sm:block">{actionButton()}</div>
        </div>

        {enrollmentStatus === "REJECTED" && enrollment?.rejectionReason && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <XCircle size={13} className="mt-0.5 shrink-0" />
            <span><span className="font-semibold">Rejected:</span> {enrollment.rejectionReason}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
          {actionButton()}
          {secondaryButtons}
        </div>
      </div>

      {requesting && (
        <RequestModal pathway={pathway} onClose={() => setRequesting(false)} />
      )}
      {sharing && (
        <SharePathwayModal pathway={pathway} onClose={() => setSharing(false)} />
      )}
    </>
  )
}

type SortKey = "name" | "newest" | "popular"
type MyStatus = "not_enrolled" | "pending" | "in_progress" | "completed"
type LengthKey = "short" | "medium" | "long"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Alphabetical" },
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Most popular" },
]

const VISIBILITY_OPTIONS: { value: PathwayVisibility; label: string }[] = [
  { value: "PUBLIC_FREE", label: "Free enroll" },
  { value: "PUBLIC_APPROVAL", label: "Approval required" },
]

const STATUS_OPTIONS: { value: MyStatus; label: string }[] = [
  { value: "not_enrolled", label: "Not enrolled" },
  { value: "pending", label: "Awaiting approval" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
]

const LENGTH_OPTIONS: { value: LengthKey; label: string }[] = [
  { value: "short", label: "1–2 courses" },
  { value: "medium", label: "3–5 courses" },
  { value: "long", label: "6+ courses" },
]

const TOPICS_SHOWN = 5

function myStatus(p: PathwayCard): MyStatus {
  const s = p.enrollment?.status
  if (s === "APPROVED") return p.isCompleted ? "completed" : "in_progress"
  if (s === "PENDING") return "pending"
  return "not_enrolled" // none, or rejected
}

function lengthOf(p: PathwayCard): LengthKey {
  const n = p._count.courses
  return n <= 2 ? "short" : n <= 5 ? "medium" : "long"
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function FilterOption({
  label,
  count,
  selected,
  onClick,
  radio = false,
}: {
  label: string
  count?: number
  selected: boolean
  onClick: () => void
  radio?: boolean
}) {
  // An option nothing matches would only empty the list; keep it visible but inactive.
  const empty = count === 0 && !selected
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      aria-pressed={selected}
      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors lg:py-1.5 ${
        selected ? "bg-blue-50 font-medium text-blue-700" : empty ? "cursor-default text-slate-300" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${radio ? "rounded-full" : "rounded"} ${
          selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {selected && (radio ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Check size={11} strokeWidth={3} />)}
      </span>
      <span className="min-w-0 flex-1 break-words leading-snug">
        {label}
        {count !== undefined && <span className={selected ? "text-blue-500" : empty ? "" : "text-slate-400"}> ({count})</span>}
      </span>
    </button>
  )
}

export function PathwayList({
  pathways,
  recommendedOrder,
  topics,
}: {
  pathways: PathwayCard[]
  recommendedOrder: string[]
  topics: TopicFilterOption[]
}) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("name")
  const [topicIds, setTopicIds] = useState<string[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [visibilities, setVisibilities] = useState<PathwayVisibility[]>([])
  const [statuses, setStatuses] = useState<MyStatus[]>([])
  const [lengths, setLengths] = useState<LengthKey[]>([])
  const [showAllTopics, setShowAllTopics] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false) // full-screen sheet, below lg only

  // While the mobile filter sheet is open, stop the page behind it from scrolling.
  useEffect(() => {
    if (!filtersOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [filtersOpen])

  const filterCount = topicIds.length + languages.length + visibilities.length + statuses.length + lengths.length
  const narrowing = !!search || filterCount > 0

  // Within a group any selected option matches; groups combine with AND.
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    const list = pathways.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))) &&
        (topicIds.length === 0 || p.topicIds.some((id) => topicIds.includes(id))) &&
        (languages.length === 0 || p.languages.some((l) => languages.includes(l))) &&
        (visibilities.length === 0 || visibilities.includes(p.visibility)) &&
        (statuses.length === 0 || statuses.includes(myStatus(p))) &&
        (lengths.length === 0 || lengths.includes(lengthOf(p)))
    )
    const byName = (a: PathwayCard, b: PathwayCard) => a.name.localeCompare(b.name)
    // With the default sort, featured pathways (in their featured order) lead the list.
    const featuredRank = (p: PathwayCard) => {
      const i = recommendedOrder.indexOf(p.id)
      return i === -1 ? Infinity : i
    }
    if (sort === "newest") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b))
    else if (sort === "popular") list.sort((a, b) => b.enrollmentCount - a.enrollmentCount || byName(a, b))
    else list.sort((a, b) => featuredRank(a) - featuredRank(b) || byName(a, b))
    return list
  }, [pathways, recommendedOrder, q, topicIds, languages, visibilities, statuses, lengths, sort])

  // Static counts over all listed pathways (not narrowed by other filters).
  const counts = useMemo(() => {
    const c = { language: {} as Record<string, number>, visibility: {} as Record<string, number>, status: {} as Record<string, number>, length: {} as Record<string, number> }
    const inc = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1)
    for (const p of pathways) {
      p.languages.forEach((l) => inc(c.language, l))
      inc(c.visibility, p.visibility)
      inc(c.status, myStatus(p))
      inc(c.length, lengthOf(p))
    }
    return c
  }, [pathways])

  // Top topics by self-enrollment; a selected topic stays visible even when collapsed.
  const visibleTopics = showAllTopics
    ? topics
    : topics.filter((t, i) => i < TOPICS_SHOWN || topicIds.includes(t.id))
  const languageOptions = LANGUAGES.filter((l) => counts.language[l.value])

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...topicIds.map((id) => ({ key: `t-${id}`, label: topics.find((t) => t.id === id)?.name ?? "Topic", remove: () => setTopicIds((v) => v.filter((x) => x !== id)) })),
    ...languages.map((l) => ({ key: `l-${l}`, label: LANGUAGES.find((o) => o.value === l)?.label ?? l, remove: () => setLanguages((v) => v.filter((x) => x !== l)) })),
    ...visibilities.map((v) => ({ key: `v-${v}`, label: VISIBILITY_OPTIONS.find((o) => o.value === v)!.label, remove: () => setVisibilities((x) => x.filter((y) => y !== v)) })),
    ...statuses.map((s) => ({ key: `s-${s}`, label: STATUS_OPTIONS.find((o) => o.value === s)!.label, remove: () => setStatuses((x) => x.filter((y) => y !== s)) })),
    ...lengths.map((l) => ({ key: `n-${l}`, label: LENGTH_OPTIONS.find((o) => o.value === l)!.label, remove: () => setLengths((x) => x.filter((y) => y !== l)) })),
  ]

  function clearAll() {
    setSearch("")
    setTopicIds([])
    setLanguages([])
    setVisibilities([])
    setStatuses([])
    setLengths([])
  }

  const filterPanel = (
    <>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sort by</h3>
        <div className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((o) => (
            <FilterOption key={o.value} radio label={o.label} selected={sort === o.value} onClick={() => setSort(o.value)} />
          ))}
        </div>
      </div>

      {topics.length > 0 && (
        <FilterGroup title="Topic">
          {visibleTopics.map((t) => (
            <FilterOption key={t.id} label={t.name} count={t.count} selected={topicIds.includes(t.id)} onClick={() => setTopicIds((v) => toggle(v, t.id))} />
          ))}
          {topics.length > TOPICS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAllTopics((s) => !s)}
              className="mt-1 self-start px-2 text-xs font-medium text-blue-600 hover:underline"
            >
              {showAllTopics ? "Show fewer" : `Show all ${topics.length} topics`}
            </button>
          )}
        </FilterGroup>
      )}

      {languageOptions.length > 0 && (
        <FilterGroup title="Language">
          {languageOptions.map((l) => (
            <FilterOption key={l.value} label={l.label} count={counts.language[l.value]} selected={languages.includes(l.value)} onClick={() => setLanguages((v) => toggle(v, l.value))} />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Enrollment type">
        {VISIBILITY_OPTIONS.map((o) => (
          <FilterOption key={o.value} label={o.label} count={counts.visibility[o.value] ?? 0} selected={visibilities.includes(o.value)} onClick={() => setVisibilities((v) => toggle(v, o.value))} />
        ))}
      </FilterGroup>

      <FilterGroup title="My status">
        {STATUS_OPTIONS.map((o) => (
          <FilterOption key={o.value} label={o.label} count={counts.status[o.value] ?? 0} selected={statuses.includes(o.value)} onClick={() => setStatuses((v) => toggle(v, o.value))} />
        ))}
      </FilterGroup>

      <FilterGroup title="Length">
        {LENGTH_OPTIONS.map((o) => (
          <FilterOption key={o.value} label={o.label} count={counts.length[o.value] ?? 0} selected={lengths.includes(o.value)} onClick={() => setLengths((v) => toggle(v, o.value))} />
        ))}
      </FilterGroup>
    </>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      {/* Filters: always shown from lg up; behind a toggle on smaller screens. */}
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-4">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pathways…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 lg:hidden"
          >
            <SlidersHorizontal size={14} />
            Filters{filterCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">{filterCount}</span>}
          </button>
        </div>

        <div className="mt-4 hidden flex-col gap-4 lg:flex">{filterPanel}</div>
      </aside>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">Sort &amp; filter</h2>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="rounded-lg p-1.5 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">{filterPanel}</div>
          <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={clearAll}
              disabled={!narrowing}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Show {filtered.length} pathway{filtered.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="mr-1 text-sm text-slate-500">
            {filtered.length} pathway{filtered.length !== 1 ? "s" : ""}
          </p>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.remove}
              className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              {c.label}
              <X size={12} />
            </button>
          ))}
          {narrowing && (
            <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
            {pathways.length === 0 ? "No pathways available yet." : "No pathways match your search or filters."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((p) => (
              <PathwayCardItem key={p.id} pathway={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
