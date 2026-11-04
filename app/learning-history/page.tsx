import type { Metadata } from "next"
export const metadata: Metadata = { title: "Learning History" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { CheckCircle2, BookOpen, Map as MapIcon, Star, Award, PlayCircle, Circle } from "lucide-react"
import type { ReactNode } from "react"
import { getLearnerPathways } from "../lib/learnerPathways"
import {
  StateBadge,
  enrollmentLabel,
  DeadlineChip,
  ProgressBar,
  GoToPathwayButton,
  UnenrollButton,
  LearnerPathwayRow,
} from "../components/LearnerPathwayParts"

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function LearningHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [courseProgressRecords, completedPathways, totalPoints, learnerPathways] = await Promise.all([
    prisma.courseProgress.findMany({
      where: { userId, completed: true },
      include: {
        course: { select: { name: true } },
        pathway: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.pathwayCourse.findMany({
      where: { course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true, courseId: true },
    }),
    prisma.userPoint.aggregate({
      where: { userId },
      _sum: { points: true },
    }),
    getLearnerPathways(userId),
  ])

  // Average test score per completed course+pathway (a course can now have multiple tests)
  const completedCourseIds = [...new Set(courseProgressRecords.map((cp) => cp.courseId))]
  const tests = completedCourseIds.length
    ? await prisma.test.findMany({
        where: { courseId: { in: completedCourseIds }, deletedAt: null },
        select: { id: true, courseId: true },
      })
    : []
  const testCourseMap = new Map(tests.map((t) => [t.id, t.courseId]))
  const testProgressRecords = tests.length
    ? await prisma.testProgress.findMany({
        where: { userId, testId: { in: tests.map((t) => t.id) } },
        select: { testId: true, pathwayId: true, score: true },
      })
    : []
  const scoresByKey = new Map<string, number[]>()
  for (const tp of testProgressRecords) {
    const courseId = testCourseMap.get(tp.testId)
    if (!courseId) continue
    const key = `${courseId}:${tp.pathwayId}`
    const arr = scoresByKey.get(key) ?? []
    arr.push(tp.score)
    scoresByKey.set(key, arr)
  }

  // Group completed courses by pathway
  const byPathway: Record<string, { pathwayId: string; pathwayName: string; courses: typeof courseProgressRecords }> = {}
  for (const cp of courseProgressRecords) {
    if (!byPathway[cp.pathwayId]) {
      byPathway[cp.pathwayId] = { pathwayId: cp.pathwayId, pathwayName: cp.pathway.name, courses: [] }
    }
    byPathway[cp.pathwayId].courses.push(cp)
  }

  // Compute completed pathways: all PUBLISHED courses done
  const totalByPathway: Record<string, number> = {}
  for (const pc of completedPathways) {
    totalByPathway[pc.pathwayId] = (totalByPathway[pc.pathwayId] ?? 0) + 1
  }
  const completedByPathway: Record<string, number> = {}
  for (const cp of courseProgressRecords) {
    completedByPathway[cp.pathwayId] = (completedByPathway[cp.pathwayId] ?? 0) + 1
  }
  const completedPathwayCount = Object.keys(byPathway).filter((pid) => {
    const total = totalByPathway[pid] ?? 0
    const done = completedByPathway[pid] ?? 0
    return total > 0 && done >= total
  }).length

  const groups = Object.values(byPathway)

  // Certificate link uses the same rules as /pathways/[id]/certificate (published
  // pathway, approved enrollment, every published course done) so it never bounces.
  const groupPathwayIds = groups.map((g) => g.pathwayId)
  const [publishedPathways, approvedEnrollments] = groupPathwayIds.length
    ? await Promise.all([
        prisma.pathway.findMany({
          where: { id: { in: groupPathwayIds }, deletedAt: null, status: "PUBLISHED" },
          select: { id: true },
        }),
        prisma.pathwayEnrollment.findMany({
          where: { userId, pathwayId: { in: groupPathwayIds }, status: "APPROVED" },
          select: { pathwayId: true },
        }),
      ])
    : [[], []]
  const publishedIds = new Set(publishedPathways.map((p) => p.id))
  const approvedIds = new Set(approvedEnrollments.map((e) => e.pathwayId))
  const completedKeys = new Set(courseProgressRecords.map((cp) => `${cp.pathwayId}:${cp.courseId}`))
  const requiredByPathway: Record<string, string[]> = {}
  for (const pc of completedPathways) {
    if (!requiredByPathway[pc.pathwayId]) requiredByPathway[pc.pathwayId] = []
    requiredByPathway[pc.pathwayId].push(pc.courseId)
  }
  const certificatePathwayIds = new Set(
    groupPathwayIds.filter((pid) => {
      const required = requiredByPathway[pid] ?? []
      return (
        publishedIds.has(pid) &&
        approvedIds.has(pid) &&
        required.length > 0 &&
        required.every((cid) => completedKeys.has(`${pid}:${cid}`))
      )
    })
  )

  // Split into the page's three sections. In progress / not started come from the
  // learner's enrollments; completed and leftover history come from course progress.
  const isGroupComplete = (pid: string) => {
    const total = totalByPathway[pid] ?? 0
    return total > 0 && (completedByPathway[pid] ?? 0) >= total
  }
  const inProgress = learnerPathways.filter((p) => p.state === "IN_PROGRESS")
  const notStarted = learnerPathways.filter((p) => p.state === "NOT_STARTED" || p.state === "PENDING")
  const activeIds = new Set([...inProgress, ...notStarted].map((p) => p.pathwayId))
  const completedGroups = groups.filter((g) => isGroupComplete(g.pathwayId))
  const otherUnfinished = groups.filter((g) => !isGroupComplete(g.pathwayId) && !activeIds.has(g.pathwayId))

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Learning History</h1>
          <p className="mt-1 text-sm text-slate-500">Your pathways, completed courses and achievements</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
              <BookOpen size={14} />
              Courses Completed
            </div>
            <p className="text-3xl font-black text-slate-900">{courseProgressRecords.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
              <MapIcon size={14} />
              Pathways Completed
            </div>
            <p className="text-3xl font-black text-slate-900">{completedPathwayCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
              <Star size={14} className="text-yellow-500" />
              Total Points
            </div>
            <p className="text-3xl font-black text-slate-900">{(totalPoints._sum.points ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* In progress: enrolled pathways with activity, most recent first, then any
            other pathway with completed courses that isn't finished (e.g. unenrolled). */}
        <Section title="In Progress" icon={<PlayCircle size={16} className="text-blue-500" />} count={inProgress.length + otherUnfinished.length}>
          {inProgress.length + otherUnfinished.length === 0 ? (
            <EmptyNote>No pathways in progress.</EmptyNote>
          ) : (
            <>
              {inProgress.map((p) => (
                <div key={p.enrollmentId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <MapIcon size={15} className="shrink-0 text-blue-500" />
                      <span className="font-semibold text-slate-800">{p.name}</span>
                    </div>
                    <StateBadge state={p.state} />
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-xs text-slate-500">
                      {enrollmentLabel(p)}
                      {p.lastActivityAt && <> · Last activity {formatDate(p.lastActivityAt)}</>}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar done={p.completedCourses} total={p.totalCourses} />
                      <DeadlineChip deadline={p.deadline} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <GoToPathwayButton pathwayId={p.pathwayId} />
                      <UnenrollButton pathwayId={p.pathwayId} />
                    </div>
                  </div>
                  <CourseList courses={byPathway[p.pathwayId]?.courses ?? []} scoresByKey={scoresByKey} />
                </div>
              ))}
              {otherUnfinished.map((group) => (
                <div key={group.pathwayId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <MapIcon size={15} className="text-blue-500" />
                      <span className="font-semibold text-slate-800">{group.pathwayName}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {completedByPathway[group.pathwayId] ?? 0}/{totalByPathway[group.pathwayId] ?? 0} courses
                    </span>
                  </div>
                  <CourseList courses={group.courses} scoresByKey={scoresByKey} />
                </div>
              ))}
            </>
          )}
        </Section>

        {/* Not started (including requests awaiting approval) */}
        <Section title="Not Started" icon={<Circle size={16} className="text-slate-400" />} count={notStarted.length}>
          {notStarted.length === 0 ? (
            <EmptyNote>No pathways waiting to be started.</EmptyNote>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {notStarted.map((p) => (
                <LearnerPathwayRow key={p.enrollmentId} item={p} />
              ))}
            </ul>
          )}
        </Section>

        {/* Completed pathways, most recently finished first */}
        <Section title="Completed" icon={<CheckCircle2 size={16} className="text-green-500" />} count={completedGroups.length}>
          {completedGroups.length === 0 ? (
            <EmptyNote>No pathways completed yet.</EmptyNote>
          ) : (
            completedGroups.map((group) => (
              <div key={group.pathwayId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <MapIcon size={15} className="text-blue-500" />
                    <span className="font-semibold text-slate-800">{group.pathwayName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {certificatePathwayIds.has(group.pathwayId) && (
                      <a
                        href={`/pathways/${group.pathwayId}/certificate`}
                        className="flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        <Award size={11} />
                        View Certificate
                      </a>
                    )}
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle2 size={11} />
                      Pathway Completed
                    </span>
                  </div>
                </div>
                <CourseList courses={group.courses} scoresByKey={scoresByKey} />
              </div>
            ))
          )}
        </Section>
      </main>
    </div>
  )
}

type CompletedCourse = {
  id: string
  courseId: string
  pathwayId: string
  completedAt: Date | null
  course: { name: string }
}

function Section({ title, icon, count, children }: { title: string; icon: ReactNode; count: number; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  )
}

function CourseList({ courses, scoresByKey }: { courses: CompletedCourse[]; scoresByKey: Map<string, number[]> }) {
  if (courses.length === 0) return null
  return (
    <ul className="divide-y divide-slate-100 border-t border-slate-100">
      {courses.map((cp) => {
        const scores = scoresByKey.get(`${cp.courseId}:${cp.pathwayId}`)
        const avgScore = scores?.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null
        return (
          <li key={cp.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={15} className="shrink-0 text-green-500" />
              <span className="text-sm text-slate-700">{cp.course.name}</span>
            </div>
            <div className="flex items-center gap-4 text-right">
              {avgScore != null && (
                <span className="text-xs font-medium text-slate-500">
                  {scores!.length > 1 ? "Avg score" : "Score"}: {Math.round(avgScore)}%
                </span>
              )}
              <span className="text-xs text-slate-400">{cp.completedAt ? formatDate(cp.completedAt) : "—"}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
