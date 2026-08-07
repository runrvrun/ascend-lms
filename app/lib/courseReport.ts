import { prisma } from "./prisma"

export async function getCourseReportData(courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    include: {
      topic: { select: { name: true } },
      trainers: { include: { user: { select: { name: true } } } },
      contents: { where: { deletedAt: null }, select: { id: true } },
      tests: { where: { deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, title: true, passThreshold: true } },
      assignment: { where: { deletedAt: null }, select: { id: true } },
      pathways: { include: { pathway: { select: { id: true, name: true, deletedAt: true } } } },
    },
  })
  if (!course) return null

  const pathwayNameById = new Map(course.pathways.map((pc) => [pc.pathwayId, pc.pathway.name]))
  const pathwayIds = course.pathways.filter((pc) => !pc.pathway.deletedAt).map((pc) => pc.pathwayId)
  const testIds = course.tests.map((t) => t.id)

  const [enrollments, progresses, testProgresses, submissions, feedbacks] = await Promise.all([
    pathwayIds.length
      ? prisma.pathwayEnrollment.findMany({
          where: { pathwayId: { in: pathwayIds }, status: "APPROVED" },
          select: {
            userId: true,
            pathwayId: true,
            createdAt: true,
            user: {
              select: { name: true, email: true, division: true, office: { select: { name: true } } },
            },
          },
        })
      : [],
    pathwayIds.length
      ? prisma.courseProgress.findMany({
          where: { courseId, pathwayId: { in: pathwayIds } },
          select: {
            userId: true,
            completed: true,
            completedAt: true,
            assignmentStatus: true,
          },
        })
      : [],
    testIds.length && pathwayIds.length
      ? prisma.testProgress.findMany({
          where: { testId: { in: testIds }, pathwayId: { in: pathwayIds } },
          select: { userId: true, testId: true, score: true, status: true },
        })
      : [],
    course.assignment
      ? prisma.assignmentSubmission.findMany({
          where: { assignmentId: course.assignment.id },
          select: { userId: true, status: true },
        })
      : [],
    prisma.courseFeedback.findMany({
      where: { courseId },
      select: { userId: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
    }),
  ])

  const feedbackByUserId = new Map(
    feedbacks.map((f) => [f.userId, { rating: f.rating, comment: f.comment, date: f.createdAt }])
  )

  // Enrollment can happen through more than one pathway containing this course —
  // collapse to one row per user, keeping the earliest enroll date across all of them.
  const byUser = new Map<
    string,
    { user: (typeof enrollments)[number]["user"]; enrollDate: Date; pathwayNames: string[] }
  >()
  for (const e of enrollments) {
    const pathwayName = pathwayNameById.get(e.pathwayId) ?? "Unknown"
    const existing = byUser.get(e.userId)
    if (!existing) {
      byUser.set(e.userId, { user: e.user, enrollDate: e.createdAt, pathwayNames: [pathwayName] })
    } else {
      if (e.createdAt < existing.enrollDate) existing.enrollDate = e.createdAt
      if (!existing.pathwayNames.includes(pathwayName)) existing.pathwayNames.push(pathwayName)
    }
  }

  // Likewise, collapse CourseProgress rows (also keyed per pathway) to one record per user.
  const progressByUser = new Map<
    string,
    { completed: boolean; completedAt: Date | null; assignmentStatus: string | null }
  >()
  for (const p of progresses) {
    const existing = progressByUser.get(p.userId)
    if (!existing) {
      progressByUser.set(p.userId, { ...p })
      continue
    }
    existing.completed = existing.completed || p.completed
    if (p.completedAt && (!existing.completedAt || p.completedAt < existing.completedAt)) existing.completedAt = p.completedAt
    if (p.assignmentStatus === "PASSED" || !existing.assignmentStatus) existing.assignmentStatus = p.assignmentStatus ?? existing.assignmentStatus
  }

  // Collapse per-test progress (also keyed per pathway) to one record per user+test,
  // preferring a passed attempt and the highest recorded score.
  const testProgressByUserTest = new Map<string, { score: number; status: string }>()
  for (const tp of testProgresses) {
    const key = `${tp.userId}:${tp.testId}`
    const existing = testProgressByUserTest.get(key)
    if (!existing) {
      testProgressByUserTest.set(key, { score: tp.score, status: tp.status })
      continue
    }
    if (tp.status === "PASSED" || existing.status !== "PASSED") {
      if (tp.score > existing.score || tp.status === "PASSED") {
        testProgressByUserTest.set(key, { score: tp.score, status: tp.status === "PASSED" ? "PASSED" : existing.status })
      }
    }
  }

  const users = [...byUser.entries()]
    .map(([userId, info]) => {
      const prog = progressByUser.get(userId)
      const completed = prog?.completed ?? false
      const completedAt = prog?.completedAt ?? null
      const timeTakenDays =
        completed && completedAt
          ? Math.max(0, Math.round((completedAt.getTime() - info.enrollDate.getTime()) / 86_400_000))
          : null
      const tests = course.tests.map((t) => {
        const tp = testProgressByUserTest.get(`${userId}:${t.id}`)
        return { id: t.id, title: t.title, status: (tp?.status as "PASSED" | "FAILED" | undefined) ?? null, score: tp?.score ?? null }
      })
      return {
        userId,
        name: info.user.name,
        email: info.user.email,
        division: info.user.division,
        office: info.user.office?.name ?? null,
        pathwayNames: info.pathwayNames,
        enrollDate: info.enrollDate,
        completed,
        completedAt,
        timeTakenDays,
        tests,
        assignmentStatus: prog?.assignmentStatus ?? null,
        feedback: feedbackByUserId.get(userId) ?? null,
      }
    })
    .sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""))

  const enrolledCount = users.length
  const completedCount = users.filter((u) => u.completed).length
  const inProgressCount = enrolledCount - completedCount
  const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0

  const testStats = course.tests.map((t) => {
    const records = [...testProgressByUserTest.entries()]
      .filter(([key]) => key.endsWith(`:${t.id}`))
      .map(([, v]) => v)
    const attemptCount = records.length
    const passedCount = records.filter((r) => r.status === "PASSED").length
    const avgScore = attemptCount ? Math.round(records.reduce((s, r) => s + r.score, 0) / attemptCount) : null
    return { id: t.id, title: t.title, passThreshold: t.passThreshold, attemptCount, passedCount, avgScore }
  })
  const allTestScores = [...testProgressByUserTest.values()].map((r) => r.score)
  const testAttemptCount = allTestScores.length
  const testPassedCount = [...testProgressByUserTest.values()].filter((r) => r.status === "PASSED").length
  const avgTestScore = allTestScores.length
    ? Math.round(allTestScores.reduce((s, v) => s + v, 0) / allTestScores.length)
    : null

  // Submission history is the source of truth for who submitted/passed — CourseProgress.assignmentStatus
  // is derived state and isn't consistently populated by the current submission flow.
  const submitterIds = new Set(submissions.map((s) => s.userId))
  const passedSubmitterIds = new Set(submissions.filter((s) => s.status === "PASSED").map((s) => s.userId))

  const avgFeedbackRating = feedbacks.length
    ? Math.round((feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length) * 10) / 10
    : null

  return {
    course: {
      id: course.id,
      name: course.name,
      description: course.description,
      status: course.status,
      topic: course.topic?.name ?? null,
      trainers: course.trainers.map((t) => t.user.name ?? "Unknown"),
      contentCount: course.contents.length,
      tests: course.tests.map((t) => ({ id: t.id, title: t.title, passThreshold: t.passThreshold })),
      hasAssignment: !!course.assignment,
      pathwayCount: pathwayIds.length,
    },
    stats: {
      enrolledCount,
      completedCount,
      inProgressCount,
      completionRate,
      tests: testStats,
      testAttemptCount,
      testPassedCount,
      avgTestScore,
      assignmentSubmittedCount: submitterIds.size,
      assignmentPassedCount: passedSubmitterIds.size,
      feedbackCount: feedbacks.length,
      avgFeedbackRating,
    },
    users,
    feedbacks: feedbacks.map((f) => ({ name: f.user.name, date: f.createdAt, rating: f.rating, comment: f.comment })),
  }
}

export type CourseReportData = NonNullable<Awaited<ReturnType<typeof getCourseReportData>>>
