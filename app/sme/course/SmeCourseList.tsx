"use client"

import { useState, useTransition } from "react"
import { GraduationCap, FileText, ClipboardList, ClipboardCheck, Plus, X } from "lucide-react"
import { createCourse, setCourseTrainer } from "../../admin/course/actions"

type CourseItem = {
  id: string
  name: string
  description: string | null
  status: "DRAFT" | "PUBLISHED"
  _count: { contents: number }
  test: { id: string } | null
  assignment: { id: string } | null
  trainers: { user: TrainerOption }[]
}
type TopicData = {
  id: string
  name: string
  courses: CourseItem[]
}

type TrainerOption = { id: string; name: string | null }

function NewCourseModal({
  topics,
  trainerUsers,
  onClose,
}: {
  topics: TopicData[]
  trainerUsers: TrainerOption[]
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "")
  const [trainerId, setTrainerId] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      try {
        const courseId = await createCourse({ name, description, topicId: topicId || null })
        await setCourseTrainer(courseId, trainerId || null)
        onClose()
      } catch {
        setError("A course with this name already exists.")
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New Course</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name <span className="text-red-500">*</span></label>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Financial Modeling Basics"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Topic <span className="text-red-500">*</span></label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Trainer</label>
            <select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No trainer —</option>
              {trainerUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SmeCourseList({ topics, trainerUsers }: { topics: TopicData[]; trainerUsers: TrainerOption[] }) {
  const [creating, setCreating] = useState(false)

  const totalCourses = topics.reduce((sum, t) => sum + t.courses.length, 0)

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Topics</h1>
          <p className="mt-1 text-sm text-slate-500">
            {topics.length} topic{topics.length !== 1 ? "s" : ""} · {totalCourses} course{totalCourses !== 1 ? "s" : ""}
          </p>
        </div>
        {topics.length > 0 && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            New Course
          </button>
        )}
      </div>

      {topics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          You have not been assigned as SME for any topics yet.
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {topics.map((topic) => (
            <section key={topic.id}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">{topic.name}</span>
                <span className="text-xs text-slate-400">{topic.courses.length} course{topic.courses.length !== 1 ? "s" : ""}</span>
              </div>
              {topic.courses.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No courses in this topic yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {topic.courses.map((course) => {
                    const trainer = course.trainers[0]?.user ?? null
                    return (
                      <a
                        key={course.id}
                        href={`/sme/course/${course.id}`}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                            <GraduationCap size={20} className="text-violet-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{course.name}</p>
                            {course.description && (
                              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{course.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <FileText size={12} />
                            {course._count.contents} content{course._count.contents !== 1 ? "s" : ""}
                          </span>
                          {course.test && <span className="flex items-center gap-1"><ClipboardList size={12} />Test</span>}
                          {course.assignment && <span className="flex items-center gap-1"><ClipboardCheck size={12} />Assignment</span>}
                        </div>
                        {trainer && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">Trainer:</span>
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{trainer.name}</span>
                          </div>
                        )}
                        <span className={`self-start rounded-full px-2 py-0.5 text-xs font-medium ${course.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {course.status === "PUBLISHED" ? "Published" : "Draft"}
                        </span>
                      </a>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {creating && <NewCourseModal topics={topics} trainerUsers={trainerUsers} onClose={() => setCreating(false)} />}
    </>
  )
}
