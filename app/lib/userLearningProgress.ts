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
  testStatus: "PASSED" | "FAILED" | null
  testScore: number | null
  assignmentStatus: "PASSED" | "FAILED" | null
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

    const detail: CourseDetail = {
      id: pc.course.id,
      name: pc.course.name,
      sectionTitle: pc.sectionTitle,
      completed: progress?.completed ?? false,
      completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
      testStatus: progress?.testStatus ?? null,
      testScore: progress?.testScore ?? null,
      assignmentStatus: progress?.assignmentStatus ?? null,
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
