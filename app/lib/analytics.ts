// The /analytics page. Everyone with an analytics role (admin, manager, trainer, SME,
// pathway owner) gets the same Users / Pathways / Courses views, restricted to the union
// of their roles' scopes; admins also get a Cohorts view.
// Progress is measured in items (lessons + tests): a course counts every item done once
// it's completed, otherwise the lessons done plus the tests passed. Datasets are small
// (a few thousand rows), so everything is loaded once and aggregated in memory.
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import { requiredContents, requiredCourses } from "./pathwayCompletion"

// Roles that can open /analytics. Session roles come from app/lib/userRoles.ts.
export const ANALYTICS_ROLES = ["ADMIN", "MANAGER", "TRAINER", "SME", "PATHWAY_OWNER"] as const

export function canViewAnalytics(roles: string[]) {
  return roles.some((r) => (ANALYTICS_ROLES as readonly string[]).includes(r))
}

export type AnalyticsViewer = { id: string; roles: string[] }

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

// One enrolled person in a pathway drill-down (approved enrollments only).
export type PathwayPerson = {
  userId: string
  name: string
  email: string
  office: string
  division: string
  title: string
  via: string // how they were enrolled
  pct: number
  coursesDone: number
  coursesTotal: number
  enrolledAt: string // ISO
  deadline: string | null // ISO, a UTC calendar date
}

export type PathwayDetail = {
  row: PathwayRow
  courses: { id: string; name: string; completed: number; started: number }[]
  people: PathwayPerson[]
}

export type CohortRow = {
  id: string
  name: string
  members: number
  pathwayCount: number
  enrollments: number // member × assigned pathway pairs with an approved enrollment
  completed: number // of those, completed
  membersDone: number // members who completed every assigned pathway they're enrolled in
  avgPct: number
  buckets: BucketCounts
}

export type CohortMember = {
  userId: string
  name: string
  email: string
  office: string
  division: string
  title: string
  avgPct: number // across the cohort's pathways they're enrolled in
  pathwaysDone: number
  pathwaysEnrolled: number
  byPathway: Record<string, number | null> // pathwayId -> % (null = not enrolled)
}

export type CohortDetail = {
  row: CohortRow
  pathways: { id: string; name: string; isDraft: boolean; enrolled: number; completed: number; avgPct: number; buckets: BucketCounts }[]
  members: CohortMember[]
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
  cohorts: CohortRow[] | null // admins only
  cohortDetail: CohortDetail | null
  isAdmin: boolean
  showPoints: boolean // points leaderboards: admins and managers (their team) only
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

// What a viewer may see: the union of their roles' scopes.
// - admin: everything.
// - manager: their direct reports, in every pathway those people are enrolled in.
// - trainer / SME: their courses, and everyone enrolled in a pathway containing one.
// - pathway owner: their pathways, and everyone enrolled in them.
// An enrollment (user × pathway) is visible when the user is on the viewer's team or the
// pathway is one whose learners they can all see (`fullPathwayIds`).
type Scope = {
  all: boolean
  userIds: string[] | null
  pathwayIds: string[] | null
  courseIds: string[] | null
  teamIds: Set<string>
  fullPathwayIds: Set<string>
}

async function resolveScope(viewer: AnalyticsViewer): Promise<Scope> {
  const roles = viewer.roles
  if (roles.includes("ADMIN")) {
    return { all: true, userIds: null, pathwayIds: null, courseIds: null, teamIds: new Set(), fullPathwayIds: new Set() }
  }

  const [team, ownedCourses, owned] = await Promise.all([
    roles.includes("MANAGER")
      ? prisma.user.findMany({ where: { managers: { some: { managerId: viewer.id } } }, select: { id: true } })
      : Promise.resolve([]),
    roles.includes("TRAINER") || roles.includes("SME")
      ? prisma.course.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(roles.includes("TRAINER") ? [{ trainers: { some: { userId: viewer.id } } }] : []),
              ...(roles.includes("SME") ? [{ topic: { smes: { some: { userId: viewer.id } } } }] : []),
            ],
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    roles.includes("PATHWAY_OWNER")
      ? prisma.pathwayOwner.findMany({ where: { userId: viewer.id }, select: { pathwayId: true } })
      : Promise.resolve([]),
  ])
  const teamIds = team.map((u) => u.id)
  const courseIds = new Set(ownedCourses.map((c) => c.id))

  const [teamEnrollments, coursePathways] = await Promise.all([
    teamIds.length
      ? prisma.pathwayEnrollment.findMany({
          where: { userId: { in: teamIds }, status: { in: ["APPROVED", "PENDING"] } },
          select: { pathwayId: true },
          distinct: ["pathwayId"],
        })
      : Promise.resolve([]),
    courseIds.size
      ? prisma.pathwayCourse.findMany({ where: { courseId: { in: [...courseIds] } }, select: { pathwayId: true } })
      : Promise.resolve([]),
  ])
  const fullPathwayIds = new Set([...coursePathways.map((pc) => pc.pathwayId), ...owned.map((o) => o.pathwayId)])
  const teamPathwayIds = teamEnrollments.map((e) => e.pathwayId)
  const ownedPathwayIds = owned.map((o) => o.pathwayId)
  const pathwayIds = [...new Set([...teamPathwayIds, ...fullPathwayIds])]

  // Courses: the viewer's own, plus every course of their team's and their owned pathways.
  const [pcs, fullLearners] = await Promise.all([
    prisma.pathwayCourse.findMany({ where: { pathwayId: { in: [...teamPathwayIds, ...ownedPathwayIds] } }, select: { courseId: true } }),
    fullPathwayIds.size
      ? prisma.pathwayEnrollment.findMany({
          where: { pathwayId: { in: [...fullPathwayIds] }, status: { in: ["APPROVED", "PENDING"] } },
          select: { userId: true },
          distinct: ["userId"],
        })
      : Promise.resolve([]),
  ])
  for (const pc of pcs) courseIds.add(pc.courseId)

  return {
    all: false,
    userIds: [...new Set([...teamIds, ...fullLearners.map((e) => e.userId)])],
    pathwayIds,
    courseIds: [...courseIds],
    teamIds: new Set(teamIds),
    fullPathwayIds,
  }
}

function enrollmentSource(e: { type: string; cohort: { name: string } | null; approvedById: string | null }) {
  if (e.cohort) return `Cohort: ${e.cohort.name}`
  if (e.type === "SELF_ENROLL") return "Self-enrolled"
  if (e.type === "USER_REQUEST") return "Requested (approved)"
  // Managers set approvedById when they assign; admins and pathway owners don't.
  return e.approvedById ? "Assigned by manager" : "Assigned by admin"
}

export async function loadAnalytics({
  viewer,
  filters,
  pathwayId,
  courseId,
  cohortTab,
  cohortId,
}: {
  viewer: AnalyticsViewer
  filters: AnalyticsFilters
  pathwayId?: string
  courseId?: string
  cohortTab?: boolean
  cohortId?: string
}): Promise<AnalyticsData> {
  const scope = await resolveScope(viewer)
  const isAdmin = scope.all
  const showPoints = isAdmin || scope.teamIds.size > 0
  const visible = (e: { userId: string; pathwayId: string }) =>
    scope.all || scope.teamIds.has(e.userId) || scope.fullPathwayIds.has(e.pathwayId)

  // Deactivated users stay in analytics — their history still counts.
  const userWhere: Prisma.UserWhereInput = {
    ...(isAdmin ? { status: "ACTIVE" } : {}),
    ...(scope.userIds ? { id: { in: scope.userIds } } : {}),
    ...(filters.division ? { division: filters.division as Prisma.UserWhereInput["division"] } : {}),
    ...(filters.title ? { title: filters.title as Prisma.UserWhereInput["title"] } : {}),
    ...(filters.officeId ? { officeId: filters.officeId } : {}),
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, email: true, division: true, title: true, lastActiveAt: true, office: { select: { name: true } } },
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
          select: { courseId: true, order: true, optional: true, course: { select: { name: true } } },
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
        contents: { where: { deletedAt: null }, select: { id: true, title: true, order: true, optional: true } },
        tests: { where: { deletedAt: null }, select: { id: true, title: true, order: true } },
        _count: { select: { assignments: { where: { deletedAt: null } } } },
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
          contents: { where: { deletedAt: null }, select: { id: true, optional: true } },
          tests: { where: { deletedAt: null }, select: { id: true } },
          _count: { select: { assignments: { where: { deletedAt: null } } } },
        },
      })
    : []
  const itemsByCourse: Record<string, { contentIds: string[]; testIds: string[] }> = {}
  for (const c of [...courses, ...extraCourses]) {
    // Progress is measured over the items needed to finish the course (optional lessons left out).
    const contents = requiredContents(c.contents, c.tests.length + c._count.assignments)
    itemsByCourse[c.id] = { contentIds: contents.map((x) => x.id), testIds: c.tests.map((x) => x.id) }
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
      select: {
        userId: true,
        pathwayId: true,
        status: true,
        deadline: true,
        type: true,
        approvedById: true,
        createdAt: true,
        cohort: { select: { name: true } },
      },
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
      select: { userId: true, pathwayId: true, assignment: { select: { courseId: true } } },
    }),
    // Points are personal, not tied to a pathway: only admins, and managers for their team.
    showPoints
      ? prisma.userPoint.groupBy({
          by: ["userId"],
          where: { userId: { in: isAdmin ? userIds : userIds.filter((id) => scope.teamIds.has(id)) } },
          _sum: { points: true },
        })
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

  const approved = enrollments.filter((e) => e.status === "APPROVED" && userIdSet.has(e.userId) && visible(e))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // ── Pathways ───────────────────────────────────────────────────────────────
  const pathwayIdSet = new Set(pathways.map((p) => p.id))
  const pathwayPct: Record<string, number> = {} // `${userId}:${pathwayId}` -> %
  const pathwayCoursesDone: Record<string, number> = {} // `${userId}:${pathwayId}` -> required courses done
  const pathwayRows: PathwayRow[] = pathways.map((p) => {
    const rows = approved.filter((e) => e.pathwayId === p.id)
    // Optional courses don't count toward a pathway's progress or completion.
    const required = requiredCourses(p.courses)
    const buckets = emptyBuckets()
    let completed = 0
    let sumPct = 0
    let overdue = 0
    for (const e of rows) {
      let done = 0
      let total = 0
      let coursesDone = 0
      for (const c of required) {
        const r = courseItemsDone(e.userId, p.id, c.courseId)
        done += r.done
        total += r.total
        if (courseDone.has(`${e.userId}:${p.id}:${c.courseId}`)) coursesDone++
      }
      const isComplete = required.length > 0 && coursesDone >= required.length
      const value = isComplete ? 100 : Math.min(99, pct(done, total))
      pathwayPct[`${e.userId}:${p.id}`] = value
      pathwayCoursesDone[`${e.userId}:${p.id}`] = coursesDone
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
      pending: enrollments.filter((e) => e.pathwayId === p.id && e.status === "PENDING" && userIdSet.has(e.userId) && visible(e)).length,
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
    const attempts = testProgress.filter((t) => testIds.has(t.testId) && userIdSet.has(t.userId) && visible(t))
    // Feedback isn't tied to a pathway: count it from this course's visible learners.
    const ratings = feedback.filter((f) => f.courseId === c.id && f.userId in best)
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
      awaitingGrading: submissions.filter((s) => s.assignment.courseId === c.id && userIdSet.has(s.userId) && visible(s)).length,
    }
  })
  courseRows.sort((a, b) => b.learners - a.learners || a.name.localeCompare(b.name))
  const courseBuckets = emptyBuckets()
  for (const r of courseRows) r.buckets.forEach((n, i) => (courseBuckets[i] += n))

  // ── Learners ───────────────────────────────────────────────────────────────
  // Admins see every user and managers their whole team; otherwise the people enrolled
  // in a visible pathway (or taking a visible course).
  const learnerIds = new Set([
    ...approved.filter((e) => pathwayIdSet.has(e.pathwayId)).map((e) => e.userId),
    ...Object.keys(coursePct).map((k) => k.split(":")[0]),
  ])
  for (const u of users) if (isAdmin || scope.teamIds.has(u.id)) learnerIds.add(u.id)
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
      people: approved
        .filter((e) => e.pathwayId === selectedPathway.id)
        .map((e) => {
          const u = userMap[e.userId]
          const key = `${e.userId}:${selectedPathway.id}`
          return {
            userId: e.userId,
            name: u?.name ?? u?.email ?? "Unknown",
            email: u?.email ?? "",
            office: u?.office?.name ?? "",
            division: u ? (u.division === "NA" ? "N/A" : u.division) : "",
            title: u ? formatEnum(u.title) : "",
            via: enrollmentSource(e),
            pct: pathwayPct[key] ?? 0,
            coursesDone: pathwayCoursesDone[key] ?? 0,
            coursesTotal: requiredCourses(selectedPathway.courses).length,
            enrolledAt: e.createdAt.toISOString(),
            deadline: e.deadline ? e.deadline.toISOString() : null,
          }
        })
        .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name)),
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
        const attempts = testProgress.filter((p) => p.testId === t.id && userIdSet.has(p.userId) && visible(p))
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

  // ── Cohorts (admins only) ──────────────────────────────────────────────────
  // A member's progress in each of the cohort's pathways, whether they were enrolled
  // through the cohort or on their own. Deleted pathways are left out.
  let cohorts: CohortRow[] | null = null
  let cohortDetail: CohortDetail | null = null
  if (isAdmin && cohortTab) {
    const cohortRecords = await prisma.cohort.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        users: { select: { userId: true } },
        pathways: { select: { pathwayId: true } },
      },
    })
    const pathwayById = Object.fromEntries(pathways.map((p) => [p.id, p]))
    const approvedKeys = new Set(approved.map((e) => `${e.userId}:${e.pathwayId}`))

    const build = (c: (typeof cohortRecords)[number]) => {
      const memberIds = c.users.map((u) => u.userId).filter((id) => userIdSet.has(id))
      const cohortPathways = c.pathways.map((cp) => pathwayById[cp.pathwayId]).filter((p): p is (typeof pathways)[number] => !!p)
      const buckets = emptyBuckets()
      let enrolledPairs = 0
      let completed = 0
      let sumPct = 0
      let membersDone = 0
      const members: CohortMember[] = memberIds.map((uid) => {
        const byPathway: Record<string, number | null> = {}
        let n = 0
        let done = 0
        let sum = 0
        for (const p of cohortPathways) {
          const key = `${uid}:${p.id}`
          if (!approvedKeys.has(key)) {
            byPathway[p.id] = null
            continue
          }
          const value = pathwayPct[key] ?? 0
          byPathway[p.id] = value
          n++
          sum += value
          if (value >= 100) done++
          buckets[bucketIndex(value)]++
        }
        enrolledPairs += n
        completed += done
        sumPct += sum
        if (n > 0 && done === n) membersDone++
        const u = userMap[uid]
        return {
          userId: uid,
          name: u?.name ?? u?.email ?? "Unknown",
          email: u?.email ?? "",
          office: u?.office?.name ?? "",
          division: u ? (u.division === "NA" ? "N/A" : u.division) : "",
          title: u ? formatEnum(u.title) : "",
          avgPct: n ? Math.round(sum / n) : 0,
          pathwaysDone: done,
          pathwaysEnrolled: n,
          byPathway,
        }
      })
      const row: CohortRow = {
        id: c.id,
        name: c.name,
        members: memberIds.length,
        pathwayCount: cohortPathways.length,
        enrollments: enrolledPairs,
        completed,
        membersDone,
        avgPct: enrolledPairs ? Math.round(sumPct / enrolledPairs) : 0,
        buckets,
      }
      return { row, cohortPathways, memberIds, members }
    }

    const built = cohortRecords.map(build)
    cohorts = built.map((b) => b.row).sort((a, b) => b.members - a.members || a.name.localeCompare(b.name))

    const selected = cohortId ? built.find((b) => b.row.id === cohortId) : undefined
    if (selected) {
      cohortDetail = {
        row: selected.row,
        pathways: selected.cohortPathways.map((p) => {
          const values = selected.memberIds
            .filter((uid) => approvedKeys.has(`${uid}:${p.id}`))
            .map((uid) => pathwayPct[`${uid}:${p.id}`] ?? 0)
          const buckets = emptyBuckets()
          for (const v of values) buckets[bucketIndex(v)]++
          return {
            id: p.id,
            name: p.name,
            isDraft: p.status === "DRAFT",
            enrolled: values.length,
            completed: buckets[5],
            avgPct: values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0,
            buckets,
          }
        }),
        members: selected.members.sort((a, b) => b.avgPct - a.avgPct || a.name.localeCompare(b.name)),
      }
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
    cohorts,
    cohortDetail,
    isAdmin,
    showPoints,
  }
}
