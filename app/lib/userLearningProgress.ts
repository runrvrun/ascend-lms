import { prisma } from "./prisma"

export type ContentDetail = {
  id: string
  title: string
  type: string
  completed: boolean
  completedAt: string | null
}

export type CourseDetail = {
  id: string
  name: string
  sectionTitle: string | null
  completed: boolean
  completedAt: string | null
  hasTest: boolean
  testStatus: "PASSED" | "FAILED" | null
  testScore: number | null
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
      pathway: { select: { name: true } },
      cohort: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const pathwayIds = [...new Set(enrollmentRecords.map((e) => e.pathwayId))]

  const [pathwayCourses, courseProgressRecords, contentProgressRecords] = await Promise.all([
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
            test: { where: { deletedAt: null }, select: { id: true } },
            assignment: { where: { deletedAt: null }, select: { id: true } },
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
        testStatus: true,
        testScore: true,
        assignmentStatus: true,
      },
    }),
    prisma.contentProgress.findMany({
      where: { userId, pathwayId: { in: pathwayIds } },
      select: { pathwayId: true, contentId: true, completedAt: true },
    }),
  ])

  const courseProgressMap = new Map(courseProgressRecords.map((cp) => [`${cp.pathwayId}:${cp.courseId}`, cp]))
  const contentCompletedAtMap = new Map(
    contentProgressRecords.map((cp) => [`${cp.pathwayId}:${cp.contentId}`, cp.completedAt])
  )

  // CourseProgress.assignmentStatus is only set once an admin grades a submission, so a
  // pending (ungraded) submission would otherwise look identical to "never submitted".
  // AssignmentSubmission is the source of truth for whether something is awaiting review.
  const assignmentIds = [...new Set(pathwayCourses.map((pc) => pc.course.assignment?.id).filter((id): id is string => !!id))]
  const submissionRecords = assignmentIds.length
    ? await prisma.assignmentSubmission.findMany({
        where: { assignmentId: { in: assignmentIds }, userId, pathwayId: { in: pathwayIds } },
        orderBy: { createdAt: "asc" },
        select: { assignmentId: true, pathwayId: true, status: true },
      })
    : []
  // Later submissions (resubmits) override earlier ones for the same assignment/pathway.
  const latestSubmissionStatusMap = new Map(
    submissionRecords.map((s) => [`${s.pathwayId}:${s.assignmentId}`, s.status])
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

    const assignmentId = pc.course.assignment?.id
    const submissionStatus = assignmentId
      ? latestSubmissionStatusMap.get(`${pc.pathwayId}:${assignmentId}`) ?? null
      : null

    const detail: CourseDetail = {
      id: pc.course.id,
      name: pc.course.name,
      sectionTitle: pc.sectionTitle,
      completed: progress?.completed ?? false,
      completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
      hasTest: !!pc.course.test,
      testStatus: progress?.testStatus ?? null,
      testScore: progress?.testScore ?? null,
      hasAssignment: !!pc.course.assignment,
      // Graded verdict (progress.assignmentStatus) wins once set; otherwise fall back to the
      // raw submission status so a pending review still shows up instead of looking untouched.
      assignmentStatus: progress?.assignmentStatus ?? submissionStatus,
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
      pathway: e.pathway,
      cohortName: e.cohort?.name ?? null,
      completedCourses,
      totalCourses,
      isCompleted: totalCourses > 0 && completedCourses >= totalCourses && e.status === "APPROVED",
      courses,
    }
  })
}
