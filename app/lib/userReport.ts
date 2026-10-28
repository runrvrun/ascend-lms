import { prisma } from "./prisma"
import { getUserLearningProgress, type EnrollmentWithCourses } from "./userLearningProgress"
import { isDeadlinePassed, startOfUtcDay } from "./pathwayDeadline"

// One user's whole learning journey, for the admin User Progress Report page and
// its Excel export (app/api/admin/users/[id]/report/route.ts). Dates are ISO strings.

const DAY_MS = 86_400_000
export const INACTIVE_AFTER_DAYS = 30

export type PathwayStatus = "Completed" | "In progress" | "Not started" | "Pending approval"
export type Timeliness = "On time" | "Late" | "Overdue" | "On track" | "No deadline"
export type CourseStatus = "Completed" | "In progress" | "Not started"

export type ReportPathway = {
  enrollmentId: string
  pathwayId: string
  name: string
  enrolledVia: string
  isAssigned: boolean
  status: PathwayStatus
  enrolledAt: string
  deadline: string | null
  completedAt: string | null
  timeliness: Timeliness | null // null while pending approval
  coursesCompleted: number
  coursesTotal: number
  progressPct: number
}

export type ReportCourse = {
  pathwayName: string
  courseName: string
  status: CourseStatus
  completedAt: string | null
  contentsCompleted: number
  contentsTotal: number
  testsPassed: number
  testsTotal: number
  assignment: "Not required" | "Not submitted" | "Awaiting grading" | "Passed" | "Failed"
}

export type ReportTest = {
  pathwayName: string
  courseName: string
  testTitle: string
  status: "Passed" | "Failed" | "Not attempted"
  score: number | null
  takenAt: string | null
}

export type ReportGrowthPlan = {
  title: string
  pathwayName: string | null
  createdAt: string
  completedAt: string | null
  confirmedAt: string | null
}

export type ReportFlag = { level: "critical" | "warning" | "info"; message: string }

export type UserReport = {
  generatedAt: string
  user: {
    id: string
    name: string | null
    email: string | null
    division: string
    title: string
    office: string | null
    roles: string[]
    managers: string[]
    accountCreatedAt: string
    deactivatedAt: string | null
    lastLoginAt: string | null
    lastActiveAt: string | null
  }
  activity: {
    lastLearningActivityAt: string | null
    activeLearningDays: number
    activeDaysLast30: number
    currentStreak: number
    longestStreak: number
    totalPoints: number
    commentsPosted: number
    feedbackGiven: number
  }
  summary: {
    pathwaysEnrolled: number
    pathwaysCompleted: number
    pathwaysInProgress: number
    pathwaysNotStarted: number
    pathwaysPending: number
    coursesCompleted: number
    coursesInProgress: number
    coursesNotStarted: number
    testsPassed: number
    testsFailed: number
    averageTestScore: number | null
    assigned: { total: number; completedOnTime: number; completedLate: number; overdue: number; open: number }
    growthPlan: { total: number; completed: number; confirmed: number; awaitingConfirmation: number }
  }
  flags: ReportFlag[]
  pathways: ReportPathway[]
  courses: ReportCourse[]
  tests: ReportTest[]
  growthPlans: ReportGrowthPlan[]
  points: { date: string; points: number; source: string }[]
  enrollments: EnrollmentWithCourses[]
}

// Current and longest run of consecutive UTC days with at least one completed
// content item — the same basis as the sidebar's learning streak.
function streaks(dates: Date[], now: Date) {
  const days = [...new Set(dates.map((d) => startOfUtcDay(d).getTime()))].sort((a, b) => a - b)
  let longest = 0
  let run = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] - days[i - 1] === DAY_MS ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  const today = startOfUtcDay(now).getTime()
  const last = days[days.length - 1]
  const current = last !== undefined && last >= today - DAY_MS ? run : 0
  return { current, longest, activeDays: days.length, activeDaysLast30: days.filter((d) => d > today - 30 * DAY_MS).length }
}

function courseStatus(c: EnrollmentWithCourses["courses"][number]): CourseStatus {
  if (c.completed) return "Completed"
  const started = c.completedContents > 0 || c.tests.some((t) => t.status) || !!c.assignmentStatus
  return started ? "In progress" : "Not started"
}

function maxDate(dates: (string | Date | null | undefined)[]): string | null {
  const times = dates.filter((d): d is string | Date => !!d).map((d) => new Date(d).getTime())
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export async function getUserReport(userId: string): Promise<UserReport | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      division: true,
      title: true,
      createdAt: true,
      deletedAt: true,
      lastLoginAt: true,
      lastActiveAt: true,
      office: { select: { name: true } },
      roles: { select: { role: true } },
      managers: { select: { manager: { select: { name: true, email: true } } } },
    },
  })
  if (!user) return null

  const now = new Date()
  const [enrollments, growthPlanRecords, contentDates, latestTest, latestSubmission, latestComment, commentsPosted, feedbackGiven, pointRecords] =
    await Promise.all([
      getUserLearningProgress(userId),
      prisma.growthPlan.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { title: true, createdAt: true, completedAt: true, confirmedAt: true, pathway: { select: { name: true } } },
      }),
      prisma.contentProgress.findMany({ where: { userId }, select: { completedAt: true } }),
      prisma.testProgress.findFirst({ where: { userId }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
      prisma.assignmentSubmission.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.comment.findFirst({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.comment.count({ where: { userId, deletedAt: null } }),
      prisma.courseFeedback.count({ where: { userId } }),
      prisma.userPoint.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { points: true, source: true, createdAt: true } }),
    ])

  // ── Pathways ──────────────────────────────────────────────────────────────
  const pathways: ReportPathway[] = enrollments.map((e) => {
    const isAssigned = e.type === "ASSIGNED" || !!e.cohortName
    const enrolledVia = e.cohortName
      ? `Cohort: ${e.cohortName}`
      : e.type === "ASSIGNED"
      ? "Assigned"
      : e.type === "USER_REQUEST"
      ? "Requested"
      : "Self-enrolled"
    const deadline = e.deadline ? new Date(e.deadline) : null
    const completedAt = e.isCompleted ? maxDate(e.courses.map((c) => c.completedAt)) : null
    const started = e.courses.some((c) => courseStatus(c) !== "Not started")

    let status: PathwayStatus
    if (e.status === "PENDING") status = "Pending approval"
    else if (e.isCompleted) status = "Completed"
    else status = started ? "In progress" : "Not started"

    let timeliness: Timeliness | null = null
    if (e.status === "APPROVED") {
      if (!deadline) timeliness = "No deadline"
      else if (completedAt) timeliness = startOfUtcDay(new Date(completedAt)) <= startOfUtcDay(deadline) ? "On time" : "Late"
      else timeliness = isDeadlinePassed(deadline, now) ? "Overdue" : "On track"
    }

    return {
      enrollmentId: e.id,
      pathwayId: e.pathwayId,
      name: e.pathway.name,
      enrolledVia,
      isAssigned,
      status,
      enrolledAt: e.enrolledAt,
      deadline: e.deadline,
      completedAt,
      timeliness,
      coursesCompleted: e.completedCourses,
      coursesTotal: e.totalCourses,
      progressPct: e.totalCourses > 0 ? Math.round((e.completedCourses / e.totalCourses) * 100) : 0,
    }
  })

  // ── Courses & tests (approved enrollments only) ───────────────────────────
  const approved = enrollments.filter((e) => e.status === "APPROVED")
  const courses: ReportCourse[] = []
  const tests: ReportTest[] = []
  for (const e of approved) {
    for (const c of e.courses) {
      courses.push({
        pathwayName: e.pathway.name,
        courseName: c.name,
        status: courseStatus(c),
        completedAt: c.completedAt,
        contentsCompleted: c.completedContents,
        contentsTotal: c.totalContents,
        testsPassed: c.tests.filter((t) => t.status === "PASSED").length,
        testsTotal: c.tests.length,
        assignment: !c.hasAssignment
          ? "Not required"
          : c.assignmentStatus === "PASSED"
          ? "Passed"
          : c.assignmentStatus === "FAILED"
          ? "Failed"
          : c.assignmentStatus === "SUBMITTED"
          ? "Awaiting grading"
          : "Not submitted",
      })
      for (const t of c.tests) {
        tests.push({
          pathwayName: e.pathway.name,
          courseName: c.name,
          testTitle: t.title,
          status: t.status === "PASSED" ? "Passed" : t.status === "FAILED" ? "Failed" : "Not attempted",
          score: t.score != null ? Math.round(t.score) : null,
          takenAt: t.completedAt ?? null,
        })
      }
    }
  }

  const growthPlans: ReportGrowthPlan[] = growthPlanRecords.map((g) => ({
    title: g.title,
    pathwayName: g.pathway?.name ?? null,
    createdAt: g.createdAt.toISOString(),
    completedAt: g.completedAt?.toISOString() ?? null,
    confirmedAt: g.confirmedAt?.toISOString() ?? null,
  }))

  // ── Activity ──────────────────────────────────────────────────────────────
  const s = streaks(contentDates.map((c) => c.completedAt), now)
  const lastLearningActivityAt = maxDate([
    ...contentDates.map((c) => c.completedAt),
    latestTest?.completedAt,
    latestSubmission?.createdAt,
    latestComment?.createdAt,
    ...growthPlanRecords.map((g) => g.completedAt),
  ])

  // ── Summary ───────────────────────────────────────────────────────────────
  const scored = tests.filter((t) => t.score != null)
  const assignedPathways = pathways.filter((p) => p.isAssigned && p.status !== "Pending approval")
  const summary: UserReport["summary"] = {
    pathwaysEnrolled: pathways.filter((p) => p.status !== "Pending approval").length,
    pathwaysCompleted: pathways.filter((p) => p.status === "Completed").length,
    pathwaysInProgress: pathways.filter((p) => p.status === "In progress").length,
    pathwaysNotStarted: pathways.filter((p) => p.status === "Not started").length,
    pathwaysPending: pathways.filter((p) => p.status === "Pending approval").length,
    coursesCompleted: courses.filter((c) => c.status === "Completed").length,
    coursesInProgress: courses.filter((c) => c.status === "In progress").length,
    coursesNotStarted: courses.filter((c) => c.status === "Not started").length,
    testsPassed: tests.filter((t) => t.status === "Passed").length,
    testsFailed: tests.filter((t) => t.status === "Failed").length,
    averageTestScore: scored.length ? Math.round(scored.reduce((a, t) => a + t.score!, 0) / scored.length) : null,
    assigned: {
      total: assignedPathways.length,
      completedOnTime: assignedPathways.filter((p) => p.status === "Completed" && p.timeliness !== "Late").length,
      completedLate: assignedPathways.filter((p) => p.timeliness === "Late").length,
      overdue: assignedPathways.filter((p) => p.timeliness === "Overdue").length,
      open: assignedPathways.filter((p) => p.status !== "Completed" && p.timeliness !== "Overdue").length,
    },
    growthPlan: {
      total: growthPlans.length,
      completed: growthPlans.filter((g) => g.completedAt).length,
      confirmed: growthPlans.filter((g) => g.confirmedAt).length,
      awaitingConfirmation: growthPlans.filter((g) => g.completedAt && !g.confirmedAt).length,
    },
  }

  // ── Flags: what HR may need to act on ─────────────────────────────────────
  const flags: ReportFlag[] = []
  const overdue = pathways.filter((p) => p.isAssigned && p.timeliness === "Overdue")
  if (overdue.length) {
    flags.push({ level: "critical", message: `${plural(overdue.length, "assigned pathway")} past deadline: ${overdue.map((p) => p.name).join(", ")}` })
  }
  const late = pathways.filter((p) => p.isAssigned && p.timeliness === "Late")
  if (late.length) {
    flags.push({ level: "warning", message: `${plural(late.length, "assigned pathway")} completed after the deadline: ${late.map((p) => p.name).join(", ")}` })
  }
  const notStarted = pathways.filter((p) => p.isAssigned && p.status === "Not started" && p.timeliness !== "Overdue")
  if (notStarted.length) {
    flags.push({ level: "warning", message: `${plural(notStarted.length, "assigned pathway")} not started yet: ${notStarted.map((p) => p.name).join(", ")}` })
  }
  const hasOpenWork = pathways.some((p) => p.status === "In progress" || p.status === "Not started")
  if (!lastLearningActivityAt) {
    flags.push({ level: "warning", message: "No learning activity recorded yet." })
  } else {
    const idleDays = Math.floor((now.getTime() - new Date(lastLearningActivityAt).getTime()) / DAY_MS)
    if (idleDays > INACTIVE_AFTER_DAYS && hasOpenWork) {
      flags.push({ level: "warning", message: `No learning activity in ${idleDays} days, with unfinished pathways.` })
    }
  }
  if (pathways.length === 0) flags.push({ level: "warning", message: "Not enrolled in any pathway." })
  const failedOutstanding = tests.filter((t) => t.status === "Failed")
  if (failedOutstanding.length) {
    flags.push({ level: "warning", message: `${plural(failedOutstanding.length, "test")} failed and not yet passed: ${failedOutstanding.map((t) => t.testTitle).join(", ")}` })
  }
  const awaitingGrading = courses.filter((c) => c.assignment === "Awaiting grading").length
  if (awaitingGrading) flags.push({ level: "info", message: `${plural(awaitingGrading, "assignment")} awaiting grading by a trainer.` })
  if (summary.growthPlan.awaitingConfirmation) {
    flags.push({ level: "info", message: `${plural(summary.growthPlan.awaitingConfirmation, "growth plan item")} completed and awaiting manager confirmation.` })
  }
  if (summary.pathwaysCompleted > 0 && growthPlans.length === 0) {
    flags.push({ level: "info", message: "Has completed pathways but no growth plan items." })
  }
  if (summary.pathwaysPending) flags.push({ level: "info", message: `${plural(summary.pathwaysPending, "enrollment request")} awaiting manager approval.` })
  if (user.deletedAt) flags.unshift({ level: "info", message: "This account is deactivated." })

  return {
    generatedAt: now.toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      division: user.division,
      title: user.title,
      office: user.office?.name ?? null,
      roles: user.roles.map((r) => r.role),
      managers: user.managers.map((m) => m.manager.name ?? m.manager.email ?? "").filter(Boolean),
      accountCreatedAt: user.createdAt.toISOString(),
      deactivatedAt: user.deletedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    },
    activity: {
      lastLearningActivityAt,
      activeLearningDays: s.activeDays,
      activeDaysLast30: s.activeDaysLast30,
      currentStreak: s.current,
      longestStreak: s.longest,
      totalPoints: pointRecords.reduce((a, p) => a + p.points, 0),
      commentsPosted,
      feedbackGiven,
    },
    summary,
    flags,
    pathways,
    courses,
    tests,
    growthPlans,
    points: pointRecords.map((p) => ({
      date: p.createdAt.toISOString(),
      points: p.points,
      source: p.source === "COURSE_COMPLETION" ? "Course completion" : p.source,
    })),
    enrollments,
  }
}
