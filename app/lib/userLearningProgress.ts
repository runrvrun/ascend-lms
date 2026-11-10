import { prisma } from "./prisma"
import { combinedAssignmentStatus, statusByAssignment } from "./assignmentStatus"

export type ContentDetail = {
  id: string
  title: string
  type: string
  completed: boolean
  completedAt: string | null
}

export type TestDetail = {
  id: string
  title: string
  status: "PASSED" | "FAILED" | null
  score: number | null
  completedAt?: string | null
}

export type CourseDetail = {
  id: string
  name: string
  sectionTitle: string | null
  completed: boolean
  completedAt: string | null
  tests: TestDetail[]
  hasAssignment: boolean
  assignmentStatus: "SUBMITTED" | "PASSED" | "FAILED" | null
  totalContents: number
  completedContents: number
  contents: ContentDetail[]
}

export type EnrollmentWithCourses = {
  id: string
  pathwayId: string
  type: string
  status: string
  deadline: string | null
  enrolledAt: string
  pathway: { name: string }
  cohortName: string | null
  completedCourses: number
  totalCourses: number
  isCompleted: boolean
  courses: CourseDetail[]
}

export async function getUserLearningProgress(userId: string): Promise<EnrollmentWithCourses[]> {
  const enrollmentRecords = await prisma.pathwayEnrollment.findMany({
    where: { userId, status: { not: "REJECTED" } },
    select: {
      id: true,
      pathwayId: true,
      type: true,
      status: true,
      deadline: true,
      createdAt: true,
      pathway: { select: { name: true } },
      cohort: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const pathwayIds = [...new Set(enrollmentRecords.map((e) => e.pathwayId))]

  const [pathwayCourses, courseProgressRecords, testProgressRecords, contentProgressRecords] = await Promise.all([
    prisma.pathwayCourse.findMany({
      where: { pathwayId: { in: pathwayIds } },
      orderBy: [{ pathwayId: "asc" }, { order: "asc" }],
      select: {
        pathwayId: true,
        sectionTitle: true,
        course: {
          select: {
            id: true,
            name: true,
            tests: { where: { deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, title: true } },
            assignments: { where: { deletedAt: null }, select: { id: true } },
            contents: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              select: { id: true, title: true, type: true },
            },
          },
        },
      },
    }),
    prisma.courseProgress.findMany({
      where: { userId, pathwayId: { in: pathwayIds } },
      select: {
        pathwayId: true,
        courseId: true,
        completed: true,
        completedAt: true,
        assignmentStatus: true,
      },
    }),
    prisma.testProgress.findMany({
      where: { userId, pathwayId: { in: pathwayIds } },
      select: { pathwayId: true, testId: true, status: true, score: true, completedAt: true },
    }),
    prisma.contentProgress.findMany({
      where: { userId, pathwayId: { in: pathwayIds } },
      select: { pathwayId: true, contentId: true, completedAt: true },
    }),
  ])

  const courseProgressMap = new Map(courseProgressRecords.map((cp) => [`${cp.pathwayId}:${cp.courseId}`, cp]))
  const testProgressMap = new Map(testProgressRecords.map((tp) => [`${tp.pathwayId}:${tp.testId}`, tp]))
  const contentCompletedAtMap = new Map(
    contentProgressRecords.map((cp) => [`${cp.pathwayId}:${cp.contentId}`, cp.completedAt])
  )

  // AssignmentSubmission is the source of truth for assignment status: CourseProgress.assignmentStatus
  // is only set once something is graded, so a pending review would otherwise look untouched.
  const assignmentIds = [...new Set(pathwayCourses.flatMap((pc) => pc.course.assignments.map((a) => a.id)))]
  const submissionRecords = assignmentIds.length
    ? await prisma.assignmentSubmission.findMany({
        where: { assignmentId: { in: assignmentIds }, userId, pathwayId: { in: pathwayIds } },
        orderBy: { createdAt: "asc" },
        select: { assignmentId: true, pathwayId: true, status: true },
      })
    : []
  const submissionsByPathway = new Map<string, typeof submissionRecords>()
  for (const s of submissionRecords) submissionsByPathway.set(s.pathwayId, [...(submissionsByPathway.get(s.pathwayId) ?? []), s])
  const statusByPathwayAssignment = new Map(
    [...submissionsByPathway].map(([pathwayId, subs]) => [pathwayId, statusByAssignment(subs)])
  )

  const coursesByPathway = new Map<string, CourseDetail[]>()
  for (const pc of pathwayCourses) {
    const progress = courseProgressMap.get(`${pc.pathwayId}:${pc.course.id}`)
    const contents: ContentDetail[] = pc.course.contents.map((content) => {
      const completedAt = contentCompletedAtMap.get(`${pc.pathwayId}:${content.id}`) ?? null
      return {
        id: content.id,
        title: content.title,
        type: content.type,
        completed: !!completedAt,
        completedAt: completedAt ? completedAt.toISOString() : null,
      }
    })

    const submissionStatus = combinedAssignmentStatus(
      pc.course.assignments.map((a) => a.id),
      statusByPathwayAssignment.get(pc.pathwayId) ?? new Map(),
    )

    const tests: TestDetail[] = pc.course.tests.map((t) => {
      const tp = testProgressMap.get(`${pc.pathwayId}:${t.id}`)
      return {
        id: t.id,
        title: t.title,
        status: tp?.status ?? null,
        score: tp?.score ?? null,
        completedAt: tp ? tp.completedAt.toISOString() : null,
      }
    })

    const detail: CourseDetail = {
      id: pc.course.id,
      name: pc.course.name,
      sectionTitle: pc.sectionTitle,
      completed: progress?.completed ?? false,
      completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
      tests,
      hasAssignment: pc.course.assignments.length > 0,
      // Combined over all the course's assignments, from the submissions themselves.
      assignmentStatus: submissionStatus ?? progress?.assignmentStatus ?? null,
      totalContents: contents.length,
      completedContents: contents.filter((c) => c.completed).length,
      contents,
    }

    const list = coursesByPathway.get(pc.pathwayId) ?? []
    list.push(detail)
    coursesByPathway.set(pc.pathwayId, list)
  }

  return enrollmentRecords.map((e) => {
    const courses = coursesByPathway.get(e.pathwayId) ?? []
    const totalCourses = courses.length
    const completedCourses = courses.filter((c) => c.completed).length
    return {
      id: e.id,
      pathwayId: e.pathwayId,
      type: e.type,
      status: e.status,
      deadline: e.deadline ? e.deadline.toISOString() : null,
      enrolledAt: e.createdAt.toISOString(),
      pathway: e.pathway,
      cohortName: e.cohort?.name ?? null,
      completedCourses,
      totalCourses,
      isCompleted: totalCourses > 0 && completedCourses >= totalCourses && e.status === "APPROVED",
      courses,
    }
  })
}
