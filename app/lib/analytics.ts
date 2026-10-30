// Shared analytics for the admin, manager, trainer and SME analytics pages. Each role
// gets the same Users / Pathways / Courses views, restricted to its own scope.
// Progress is measured in items (lessons + tests): a course counts every item done once
// it's completed, otherwise the lessons done plus the tests passed. Datasets are small
// (a few thousand rows), so everything is loaded once and aggregated in memory.
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

export type AnalyticsRole = "admin" | "manager" | "trainer" | "sme"

export type AnalyticsFilters = { division?: string; title?: string; officeId?: string }

// Completion-percentage buckets, in display order.
export const COMPLETION_BUCKETS = [
  { key: "none", label: "Not started" },
  { key: "q1", label: "1–24%" },
  { key: "q2", label: "25–49%" },
  { key: "q3", label: "50–74%" },
  { key: "q4", label: "75–99%" },
  { key: "done", label: "Completed" },
] as const

export type BucketCounts = number[] // same order as COMPLETION_BUCKETS

function bucketIndex(pct: number) {
  if (pct >= 100) return 5
  if (pct <= 0) return 0
  if (pct < 25) return 1
  if (pct < 50) return 2
  if (pct < 75) return 3
  return 4
}

function emptyBuckets(): BucketCounts {
  return COMPLETION_BUCKETS.map(() => 0)
}

export type PathwayRow = {
  id: string
  name: string
  isDraft: boolean
  courseCount: number
  enrolled: number
  completed: number
  avgPct: number
  buckets: BucketCounts
  overdue: number
  pending: number
}

export type CourseRow = {
  id: string
  name: string
  isDraft: boolean
  itemCount: number
  learners: number
  completed: number
  avgPct: number
  buckets: BucketCounts
  avgTestScore: number | null
  testPassRate: number | null
  avgRating: number | null
  ratingCount: number
  awaitingGrading: number
}

export type CountRow = { label: string; value: number }
export type LearnerRow = { id: string; name: string; sub: string; value: number }

export type PathwayDetail = {
  row: PathwayRow
  courses: { id: string; name: string; completed: number; started: number }[]
}

export type CourseDetail = {
  row: CourseRow
  items: { id: string; title: string; kind: "content" | "test"; done: number }[]
  tests: { id: string; title: string; attempted: number; passed: number; avgScore: number | null }[]
}

export type AnalyticsData = {
  learnerCount: number
  activeLearners: number // signed in within the last 30 days
  pathwayEnrollments: number
  pathwayCompleted: number
  courseEnrollments: number
  courseCompleted: number
  byDivision: CountRow[]
  byTitle: CountRow[]
  topEarners: LearnerRow[]
  topCompleters: LearnerRow[]
  pathways: PathwayRow[]
  pathwayBuckets: BucketCounts
  courses: CourseRow[]
  courseBuckets: BucketCounts
  pathwayDetail: PathwayDetail | null
  courseDetail: CourseDetail | null
}

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

function countBy<T>(items: T[], key: (item: T) => string): CountRow[] {
  const counts: Record<string, number> = {}
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

// Which pathways, courses and learners a role may see. null = no restriction.
async function resolveScope(role: AnalyticsRole, viewerId: string) {
  if (role === "admin") return { userIds: null, pathwayIds: null, courseIds: null }

  if (role === "manager") {
    const team = await prisma.user.findMany({ where: { managers: { some: { managerId: viewerId } } }, select: { id: true } })
    const userIds = team.map((u) => u.id)
    const enrolled = await prisma.pathwayEnrollment.findMany({
      where: { userId: { in: userIds }, status: { in: ["APPROVED", "PENDING"] } },
      select: { pathwayId: true },
      distinct: ["pathwayId"],
    })
    const pathwayIds = enrolled.map((e) => e.pathwayId)
    const pcs = await prisma.pathwayCourse.findMany({ where: { pathwayId: { in: pathwayIds } }, select: { courseId: true } })
    return { userIds, pathwayIds, courseIds: [...new Set(pcs.map((pc) => pc.courseId))] }
  }

  const courses = await prisma.course.findMany({
    where: role === "trainer"
      ? { deletedAt: null, trainers: { some: { userId: viewerId } } }
      : { deletedAt: null, topic: { smes: { some: { userId: viewerId } } } },
    select: { id: true },
  })
  const courseIds = courses.map((c) => c.id)
  const pcs = await prisma.pathwayCourse.findMany({ where: { courseId: { in: courseIds } }, select: { pathwayId: true } })
  const pathwayIds = [...new Set(pcs.map((pc) => pc.pathwayId))]
  // Learners = anyone enrolled in a pathway that contains one of these courses.
  const enrolled = await prisma.pathwayEnrollment.findMany({
    where: { pathwayId: { in: pathwayIds }, status: "APPROVED" },
    select: { userId: true },
    distinct: ["userId"],
  })
  return { userIds: enrolled.map((e) => e.userId), pathwayIds, courseIds }
}

export async function loadAnalytics({
  role,
  viewerId,
  filters,
  pathwayId,
  courseId,
}: {
  role: AnalyticsRole
  viewerId: string
  filters: AnalyticsFilters
  pathwayId?: string
  courseId?: string
}): Promise<AnalyticsData> {
  const scope = await resolveScope(role, viewerId)

  // Deactivated users stay in analytics — their history still counts.
  const userWhere: Prisma.UserWhereInput = {
    ...(role === "admin" ? { status: "ACTIVE" } : {}),
    ...(scope.userIds ? { id: { in: scope.userIds } } : {}),
    ...(filters.division ? { division: filters.division as Prisma.UserWhereInput["division"] } : {}),
    ...(filters.title ? { title: filters.title as Prisma.UserWhereInput["title"] } : {}),
    ...(filters.officeId ? { officeId: filters.officeId } : {}),
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, email: true, division: true, title: true, lastActiveAt: true },
  })
  const userIds = users.map((u) => u.id)
  const userIdSet = new Set(userIds)
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const [pathways, courses] = await Promise.all([
    prisma.pathway.findMany({
      where: { deletedAt: null, ...(scope.pathwayIds ? { id: { in: scope.pathwayIds } } : {}) },
      select: {
        id: true,
        name: true,
        status: true,
        courses: {
          where: { course: { deletedAt: null, status: "PUBLISHED" } },
          select: { courseId: true, order: true, course: { select: { name: true } } },
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.course.findMany({
      where: { deletedAt: null, ...(scope.courseIds ? { id: { in: scope.courseIds } } : {}) },
      select: {
        id: true,
        name: true,
        status: true,
        contents: { where: { deletedAt: null }, select: { id: true, title: true, order: true } },
        tests: { where: { deletedAt: null }, select: { id: true, title: true, order: true } },
        assignment: { select: { id: true } },
        pathways: { select: { pathwayId: true } },
      },
    }),
  ])

  // Every course whose items feed a progress figure: scoped courses plus the courses of
  // scoped pathways (pathway progress is measured across all of its courses).
  const pathwayCourseIds = new Set(pathways.flatMap((p) => p.courses.map((c) => c.courseId)))
  const missingCourseIds = [...pathwayCourseIds].filter((id) => !courses.some((c) => c.id === id))
  const extraCourses = missingCourseIds.length
    ? await prisma.course.findMany({
        where: { id: { in: missingCourseIds } },
        select: {
          id: true,
          contents: { where: { deletedAt: null }, select: { id: true } },
          tests: { where: { deletedAt: null }, select: { id: true } },
        },
      })
    : []
  const itemsByCourse: Record<string, { contentIds: string[]; testIds: string[] }> = {}
  for (const c of [...courses, ...extraCourses]) {
    itemsByCourse[c.id] = { contentIds: c.contents.map((x) => x.id), testIds: c.tests.map((x) => x.id) }
  }
  const allContentIds = Object.values(itemsByCourse).flatMap((c) => c.contentIds)
  const allTestIds = Object.values(itemsByCourse).flatMap((c) => c.testIds)

  // Pathways a scoped course appears in, so course learners can be found from enrollments.
  const enrollmentPathwayIds = [...new Set([...pathways.map((p) => p.id), ...courses.flatMap((c) => c.pathways.map((p) => p.pathwayId))])]

  // Unfiltered admin view: skip a huge IN list; rows are matched to users in memory.
  const userFilter = scope.userIds || filters.division || filters.title || filters.officeId ? { userId: { in: userIds } } : {}

  const [enrollments, courseProgress, contentProgress, testProgress, feedback, submissions, points] = await Promise.all([
    prisma.pathwayEnrollment.findMany({
      where: { pathwayId: { in: enrollmentPathwayIds }, status: { in: ["APPROVED", "PENDING"] }, ...userFilter },
      select: { userId: true, pathwayId: true, status: true, deadline: true },
    }),
    prisma.courseProgress.findMany({
      where: { completed: true, courseId: { in: Object.keys(itemsByCourse) }, ...userFilter },
      select: { userId: true, courseId: true, pathwayId: true },
    }),
    prisma.contentProgress.findMany({
      where: { contentId: { in: allContentIds }, ...userFilter },
      select: { userId: true, contentId: true, pathwayId: true },
    }),
    prisma.testProgress.findMany({
      where: { testId: { in: allTestIds }, ...userFilter },
      select: { userId: true, testId: true, pathwayId: true, score: true, status: true },
    }),
    prisma.courseFeedback.findMany({
      where: { courseId: { in: courses.map((c) => c.id) }, ...userFilter },
      select: { userId: true, courseId: true, rating: true },
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: "SUBMITTED", assignment: { deletedAt: null, courseId: { in: courses.map((c) => c.id) } }, ...userFilter },
      select: { userId: true, assignment: { select: { courseId: true } } },
    }),
    role === "admin" || role === "manager"
      ? prisma.userPoint.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _sum: { points: true } })
      : Promise.resolve([]),
  ])

  // Lookups keyed by user:pathway:item.
  const courseDone = new Set(courseProgress.map((p) => `${p.userId}:${p.pathwayId}:${p.courseId}`))
  const contentDone = new Set(contentProgress.map((p) => `${p.userId}:${p.pathwayId}:${p.contentId}`))
  const testPassed = new Set(testProgress.filter((t) => t.status === "PASSED").map((t) => `${t.userId}:${t.pathwayId}:${t.testId}`))

  function courseItemsDone(userId: string, pathwayId: string, cId: string) {
    const items = itemsByCourse[cId]
    if (!items) return { done: 0, total: 0 }
    const total = items.contentIds.length + items.testIds.length
    if (courseDone.has(`${userId}:${pathwayId}:${cId}`)) return { done: total, total }
    let done = 0
    for (const id of items.contentIds) if (contentDone.has(`${userId}:${pathwayId}:${id}`)) done++
    for (const id of items.testIds) if (testPassed.has(`${userId}:${pathwayId}:${id}`)) done++
    return { done, total }
  }

  const approved = enrollments.filter((e) => e.status === "APPROVED" && userIdSet.has(e.userId))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // ── Pathways ───────────────────────────────────────────────────────────────
  const pathwayIdSet = new Set(pathways.map((p) => p.id))
  const pathwayPct: Record<string, number> = {} // `${userId}:${pathwayId}` -> %
  const pathwayRows: PathwayRow[] = pathways.map((p) => {
    const rows = approved.filter((e) => e.pathwayId === p.id)
    const buckets = emptyBuckets()
    let completed = 0
    let sumPct = 0
    let overdue = 0
    for (const e of rows) {
      let done = 0
      let total = 0
      let coursesDone = 0
      for (const c of p.courses) {
        const r = courseItemsDone(e.userId, p.id, c.courseId)
        done += r.done
        total += r.total
        if (courseDone.has(`${e.userId}:${p.id}:${c.courseId}`)) coursesDone++
      }
      const isComplete = p.courses.length > 0 && coursesDone >= p.courses.length
      const value = isComplete ? 100 : Math.min(99, pct(done, total))
      pathwayPct[`${e.userId}:${p.id}`] = value
      buckets[bucketIndex(value)]++
      sumPct += value
      if (isComplete) completed++
      else if (e.deadline && e.deadline < today) overdue++
    }
    return {
      id: p.id,
      name: p.name,
      isDraft: p.status === "DRAFT",
      courseCount: p.courses.length,
      enrolled: rows.length,
      completed,
      avgPct: rows.length ? Math.round(sumPct / rows.length) : 0,
      buckets,
      overdue,
      pending: enrollments.filter((e) => e.pathwayId === p.id && e.status === "PENDING" && userIdSet.has(e.userId)).length,
    }
  })
  pathwayRows.sort((a, b) => b.enrolled - a.enrolled || a.name.localeCompare(b.name))
  const pathwayBuckets = emptyBuckets()
  for (const r of pathwayRows) r.buckets.forEach((n, i) => (pathwayBuckets[i] += n))

  // ── Courses ────────────────────────────────────────────────────────────────
  // A learner takes a course through any pathway that contains it; when they have more
  // than one, their furthest progress counts.
  const coursePct: Record<string, number> = {} // `${userId}:${courseId}` -> %
  const courseRows: CourseRow[] = courses.map((c) => {
    const pathwaysWithCourse = new Set(c.pathways.map((p) => p.pathwayId))
    const best: Record<string, number> = {}
    for (const e of approved) {
      if (!pathwaysWithCourse.has(e.pathwayId)) continue
      const r = courseItemsDone(e.userId, e.pathwayId, c.id)
      const value = courseDone.has(`${e.userId}:${e.pathwayId}:${c.id}`) ? 100 : Math.min(99, pct(r.done, r.total))
      best[e.userId] = Math.max(best[e.userId] ?? 0, value)
    }
    const buckets = emptyBuckets()
    let sumPct = 0
    for (const [uid, value] of Object.entries(best)) {
      coursePct[`${uid}:${c.id}`] = value
      buckets[bucketIndex(value)]++
      sumPct += value
    }
    const learners = Object.keys(best).length
    const testIds = new Set(c.tests.map((t) => t.id))
    const attempts = testProgress.filter((t) => testIds.has(t.testId) && userIdSet.has(t.userId))
    const ratings = feedback.filter((f) => f.courseId === c.id && userIdSet.has(f.userId))
    return {
      id: c.id,
      name: c.name,
      isDraft: c.status === "DRAFT",
      itemCount: c.contents.length + c.tests.length,
      learners,
      completed: buckets[5],
      avgPct: learners ? Math.round(sumPct / learners) : 0,
      buckets,
      avgTestScore: attempts.length ? Math.round(attempts.reduce((s, t) => s + t.score, 0) / attempts.length) : null,
      testPassRate: attempts.length ? pct(attempts.filter((t) => t.status === "PASSED").length, attempts.length) : null,
      avgRating: ratings.length ? Math.round((ratings.reduce((s, f) => s + f.rating, 0) / ratings.length) * 10) / 10 : null,
      ratingCount: ratings.length,
      awaitingGrading: submissions.filter((s) => s.assignment.courseId === c.id && userIdSet.has(s.userId)).length,
    }
  })
  courseRows.sort((a, b) => b.learners - a.learners || a.name.localeCompare(b.name))
  const courseBuckets = emptyBuckets()
  for (const r of courseRows) r.buckets.forEach((n, i) => (courseBuckets[i] += n))

  // ── Learners ───────────────────────────────────────────────────────────────
  // Trainers have no pathway view, so their learners are the people taking their courses.
  const learnerIds = new Set(
    role === "trainer"
      ? Object.keys(coursePct).map((k) => k.split(":")[0])
      : approved.filter((e) => pathwayIdSet.has(e.pathwayId)).map((e) => e.userId)
  )
  if (role === "admin" || role === "manager") for (const u of users) learnerIds.add(u.id)
  const learners = users.filter((u) => learnerIds.has(u.id))
  const monthAgo = Date.now() - 30 * 86_400_000

  const completedCourses: Record<string, number> = {}
  for (const [key, value] of Object.entries(coursePct)) {
    if (value >= 100) {
      const uid = key.split(":")[0]
      completedCourses[uid] = (completedCourses[uid] ?? 0) + 1
    }
  }
  const learnerRow = (uid: string, value: number): LearnerRow => {
    const u = userMap[uid]
    return { id: uid, name: u?.name ?? u?.email ?? "Unknown", sub: u ? `${u.division === "NA" ? "N/A" : u.division} · ${formatEnum(u.title)}` : "", value }
  }

  const scopedPathwayRows = pathwayRows.reduce((s, r) => s + r.enrolled, 0)

  // ── Drill-downs ────────────────────────────────────────────────────────────
  let pathwayDetail: PathwayDetail | null = null
  const selectedPathway = pathwayId ? pathways.find((p) => p.id === pathwayId) : undefined
  if (selectedPathway) {
    const enrolledIds = approved.filter((e) => e.pathwayId === selectedPathway.id).map((e) => e.userId)
    pathwayDetail = {
      row: pathwayRows.find((r) => r.id === selectedPathway.id)!,
      courses: selectedPathway.courses.map((c) => {
        let completed = 0
        let started = 0
        for (const uid of enrolledIds) {
          const r = courseItemsDone(uid, selectedPathway.id, c.courseId)
          if (courseDone.has(`${uid}:${selectedPathway.id}:${c.courseId}`)) completed++
          else if (r.done > 0) started++
        }
        return { id: c.courseId, name: c.course.name, completed, started }
      }),
    }
  }

  let courseDetail: CourseDetail | null = null
  const selectedCourse = courseId ? courses.find((c) => c.id === courseId) : undefined
  if (selectedCourse) {
    const pathwaysWithCourse = new Set(selectedCourse.pathways.map((p) => p.pathwayId))
    const takers = approved.filter((e) => pathwaysWithCourse.has(e.pathwayId))
    const doneBy = (key: (e: (typeof takers)[number]) => string, set: Set<string>) =>
      new Set(takers.filter((e) => set.has(key(e)) || courseDone.has(`${e.userId}:${e.pathwayId}:${selectedCourse.id}`)).map((e) => e.userId)).size
    const items = [
      ...selectedCourse.contents.map((x) => ({ id: x.id, title: x.title, order: x.order ?? 0, kind: "content" as const })),
      ...selectedCourse.tests.map((x) => ({ id: x.id, title: x.title, order: x.order ?? 0, kind: "test" as const })),
    ].sort((a, b) => a.order - b.order)
    courseDetail = {
      row: courseRows.find((r) => r.id === selectedCourse.id)!,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        done: item.kind === "content"
          ? doneBy((e) => `${e.userId}:${e.pathwayId}:${item.id}`, contentDone)
          : doneBy((e) => `${e.userId}:${e.pathwayId}:${item.id}`, testPassed),
      })),
      tests: selectedCourse.tests.map((t) => {
        const attempts = testProgress.filter((p) => p.testId === t.id && userIdSet.has(p.userId))
        return {
          id: t.id,
          title: t.title,
          attempted: new Set(attempts.map((a) => a.userId)).size,
          passed: new Set(attempts.filter((a) => a.status === "PASSED").map((a) => a.userId)).size,
          avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : null,
        }
      }),
    }
  }

  return {
    learnerCount: learners.length,
    activeLearners: learners.filter((u) => u.lastActiveAt && u.lastActiveAt.getTime() >= monthAgo).length,
    pathwayEnrollments: scopedPathwayRows,
    pathwayCompleted: pathwayRows.reduce((s, r) => s + r.completed, 0),
    courseEnrollments: courseRows.reduce((s, r) => s + r.learners, 0),
    courseCompleted: courseRows.reduce((s, r) => s + r.completed, 0),
    byDivision: countBy(learners, (u) => (u.division === "NA" ? "N/A" : u.division)),
    byTitle: countBy(learners, (u) => formatEnum(u.title)),
    topEarners: points
      .map((p) => learnerRow(p.userId, p._sum.points ?? 0))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    topCompleters: Object.entries(completedCourses)
      .filter(([uid]) => learnerIds.has(uid))
      .map(([uid, n]) => learnerRow(uid, n))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    pathways: pathwayRows,
    pathwayBuckets,
    courses: courseRows,
    courseBuckets,
    pathwayDetail,
    courseDetail,
  }
}
