import { prisma } from "./prisma"

export async function awardCoursePoints(userId: string, courseId: string, pathwayId: string) {
  // Use referenceId to ensure points are only awarded once per course+pathway
  const referenceId = `${courseId}:${pathwayId}`
  const already = await prisma.userPoint.findFirst({
    where: { userId, source: "COURSE_COMPLETION", referenceId },
  })
  if (already) return

  const pathwayCourse = await prisma.pathwayCourse.findUnique({
    where: { pathwayId_courseId: { pathwayId, courseId } },
    select: { points: true },
  })
  if (!pathwayCourse) return

  await prisma.userPoint.create({
    data: { userId, points: pathwayCourse.points, source: "COURSE_COMPLETION", referenceId },
  })
}

// Checks all content done + all tests passed + every assignment passed, and
// marks the course complete + awards points when so. Safe to call from any of
// the three trigger points (content toggle, test submit, assignment grade).
export async function evaluateCourseCompletion(userId: string, courseId: string, pathwayId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      contents: { where: { deletedAt: null }, select: { id: true } },
      tests: { where: { deletedAt: null }, select: { id: true } },
      assignments: { where: { deletedAt: null }, select: { id: true } },
    },
  })
  if (!course) return false

  const allContentsComplete =
    course.contents.length === 0 ||
    (await prisma.contentProgress.count({
      where: { userId, pathwayId, contentId: { in: course.contents.map((c) => c.id) } },
    })) === course.contents.length

  const allTestsPassed =
    course.tests.length === 0 ||
    (await prisma.testProgress.count({
      where: { userId, pathwayId, status: "PASSED", testId: { in: course.tests.map((t) => t.id) } },
    })) === course.tests.length

  const assignmentPassed =
    course.assignments.length === 0 ||
    (
      await prisma.assignmentSubmission.findMany({
        where: { userId, pathwayId, status: "PASSED", assignmentId: { in: course.assignments.map((a) => a.id) } },
        distinct: ["assignmentId"],
        select: { assignmentId: true },
      })
    ).length === course.assignments.length

  const isComplete = allContentsComplete && allTestsPassed && assignmentPassed
  if (!isComplete) return false
  const assignmentStatus = course.assignments.length ? ("PASSED" as const) : null

  await prisma.courseProgress.upsert({
    where: { userId_courseId_pathwayId: { userId, courseId, pathwayId } },
    create: { userId, courseId, pathwayId, completed: true, completedAt: new Date(), assignmentStatus },
    update: { completed: true, completedAt: new Date(), assignmentStatus },
  })
  await awardCoursePoints(userId, courseId, pathwayId)
  return true
}

// The combined assignment verdict stored on CourseProgress.assignmentStatus (for reports):
// PASSED once every live assignment has a passed submission, FAILED if any assignment's
// latest submission failed, otherwise null (nothing graded yet, or still pending).
export async function courseAssignmentStatus(
  userId: string,
  courseId: string,
  pathwayId: string,
): Promise<"PASSED" | "FAILED" | null> {
  const assignments = await prisma.assignment.findMany({ where: { courseId, deletedAt: null }, select: { id: true } })
  if (!assignments.length) return null
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { userId, pathwayId, assignmentId: { in: assignments.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
    select: { assignmentId: true, status: true },
  })
  const passed = new Set(submissions.filter((s) => s.status === "PASSED").map((s) => s.assignmentId))
  if (assignments.every((a) => passed.has(a.id))) return "PASSED"
  const latest = new Map<string, string>()
  for (const s of submissions) if (!latest.has(s.assignmentId)) latest.set(s.assignmentId, s.status)
  return assignments.some((a) => !passed.has(a.id) && latest.get(a.id) === "FAILED") ? "FAILED" : null
}

// Completion is only evaluated when a learner finishes something, so deleting the one item a
// learner hadn't done would leave the course incomplete forever. Call after removing a content
// item, test or assignment to re-check everyone who may now be done.
export async function recheckCourseCompletionAfterRemoval(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      contents: { where: { deletedAt: null }, select: { id: true } },
      tests: { where: { deletedAt: null }, select: { id: true } },
    },
  })
  // An emptied course isn't auto-completed for everyone; that matches how a new empty course behaves.
  if (!course || course.contents.length + course.tests.length === 0) return

  // Cheap pre-filter: only learners who finished every remaining content item (or, in a
  // test-only course, passed every test) can be done. evaluateCourseCompletion decides.
  const candidates = course.contents.length
    ? await prisma.contentProgress.groupBy({
        by: ["userId", "pathwayId"],
        where: { contentId: { in: course.contents.map((c) => c.id) } },
        having: { contentId: { _count: { equals: course.contents.length } } },
      })
    : await prisma.testProgress.groupBy({
        by: ["userId", "pathwayId"],
        where: { status: "PASSED", testId: { in: course.tests.map((t) => t.id) } },
        having: { testId: { _count: { equals: course.tests.length } } },
      })

  const alreadyComplete = new Set(
    (
      await prisma.courseProgress.findMany({ where: { courseId, completed: true }, select: { userId: true, pathwayId: true } })
    ).map((p) => `${p.userId}:${p.pathwayId}`)
  )
  for (const c of candidates) {
    if (!alreadyComplete.has(`${c.userId}:${c.pathwayId}`)) await evaluateCourseCompletion(c.userId, courseId, c.pathwayId)
  }
}
