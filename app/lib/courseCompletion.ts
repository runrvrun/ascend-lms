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

// Checks all content done + all tests passed + assignment (if any) passed, and
// marks the course complete + awards points when so. Safe to call from any of
// the three trigger points (content toggle, test submit, assignment grade).
export async function evaluateCourseCompletion(userId: string, courseId: string, pathwayId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      contents: { where: { deletedAt: null }, select: { id: true } },
      tests: { where: { deletedAt: null }, select: { id: true } },
      assignment: { select: { id: true, deletedAt: true } },
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

  const activeAssignment = course.assignment && course.assignment.deletedAt === null ? course.assignment : null
  const assignmentPassed = activeAssignment
    ? !!(await prisma.assignmentSubmission.findFirst({
        where: { assignmentId: activeAssignment.id, userId, pathwayId, status: "PASSED" },
      }))
    : true

  const isComplete = allContentsComplete && allTestsPassed && assignmentPassed
  if (!isComplete) return false

  await prisma.courseProgress.upsert({
    where: { userId_courseId_pathwayId: { userId, courseId, pathwayId } },
    create: { userId, courseId, pathwayId, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  })
  await awardCoursePoints(userId, courseId, pathwayId)
  return true
}
