import { EnrollmentStatus, EnrollmentType } from "@prisma/client"
import { prisma } from "./prisma"

// A learner's enrolled pathways with a display state, for the dashboard card and
// Learning History. "Last activity" is the most recent lesson completed, test
// taken or course finished in that pathway — Ascend doesn't record page views.

export type LearnerPathwayState = "IN_PROGRESS" | "NOT_STARTED" | "PENDING" | "COMPLETED"

export type LearnerPathway = {
  enrollmentId: string
  pathwayId: string
  name: string
  type: EnrollmentType
  status: EnrollmentStatus
  deadline: Date | null
  cohortName: string | null
  approverName: string | null
  enrolledAt: Date
  totalCourses: number
  completedCourses: number
  lastActivityAt: Date | null
  state: LearnerPathwayState
}

const STATE_RANK: Record<LearnerPathwayState, number> = {
  IN_PROGRESS: 0,
  NOT_STARTED: 1,
  PENDING: 2,
  COMPLETED: 3,
}

function latest(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null
  if (!b) return a
  return a > b ? a : b
}

export async function getLearnerPathways(userId: string): Promise<LearnerPathway[]> {
  const enrollments = await prisma.pathwayEnrollment.findMany({
    where: { userId, status: { not: "REJECTED" }, pathway: { deletedAt: null, status: "PUBLISHED" } },
    include: {
      pathway: { select: { name: true } },
      cohort: { select: { name: true } },
      approver: { select: { name: true } },
    },
  })
  if (enrollments.length === 0) return []

  const pathwayIds = enrollments.map((e) => e.pathwayId)
  const [required, courseDone, contentLast, testLast] = await Promise.all([
    prisma.pathwayCourse.findMany({
      where: { pathwayId: { in: pathwayIds }, course: { status: "PUBLISHED", deletedAt: null } },
      select: { pathwayId: true, courseId: true },
    }),
    prisma.courseProgress.findMany({
      where: { userId, pathwayId: { in: pathwayIds }, completed: true },
      select: { pathwayId: true, courseId: true, completedAt: true },
    }),
    prisma.contentProgress.groupBy({
      by: ["pathwayId"],
      where: { userId, pathwayId: { in: pathwayIds } },
      _max: { completedAt: true },
    }),
    prisma.testProgress.groupBy({
      by: ["pathwayId"],
      where: { userId, pathwayId: { in: pathwayIds } },
      _max: { completedAt: true },
    }),
  ])

  const requiredByPathway = new Map<string, Set<string>>()
  for (const pc of required) {
    if (!requiredByPathway.has(pc.pathwayId)) requiredByPathway.set(pc.pathwayId, new Set())
    requiredByPathway.get(pc.pathwayId)!.add(pc.courseId)
  }

  const doneByPathway = new Map<string, number>()
  const lastByPathway = new Map<string, Date | null>()
  for (const cp of courseDone) {
    if (requiredByPathway.get(cp.pathwayId)?.has(cp.courseId)) {
      doneByPathway.set(cp.pathwayId, (doneByPathway.get(cp.pathwayId) ?? 0) + 1)
    }
    lastByPathway.set(cp.pathwayId, latest(lastByPathway.get(cp.pathwayId), cp.completedAt))
  }
  for (const r of [...contentLast, ...testLast]) {
    lastByPathway.set(r.pathwayId, latest(lastByPathway.get(r.pathwayId), r._max.completedAt))
  }

  const items: LearnerPathway[] = enrollments.map((e) => {
    const totalCourses = requiredByPathway.get(e.pathwayId)?.size ?? 0
    const completedCourses = doneByPathway.get(e.pathwayId) ?? 0
    const lastActivityAt = lastByPathway.get(e.pathwayId) ?? null
    const state: LearnerPathwayState =
      totalCourses > 0 && completedCourses >= totalCourses
        ? "COMPLETED"
        : e.status === "PENDING"
          ? "PENDING"
          : lastActivityAt
            ? "IN_PROGRESS"
            : "NOT_STARTED"
    return {
      enrollmentId: e.id,
      pathwayId: e.pathwayId,
      name: e.pathway.name,
      type: e.type,
      status: e.status,
      deadline: e.deadline,
      cohortName: e.cohort?.name ?? null,
      approverName: e.approver?.name ?? null,
      enrolledAt: e.createdAt,
      totalCourses,
      completedCourses,
      lastActivityAt,
      state,
    }
  })

  // In progress first, most recently active on top; the rest newest enrollment first
  // (completed: most recently active first).
  return items.sort((a, b) => {
    const byState = STATE_RANK[a.state] - STATE_RANK[b.state]
    if (byState !== 0) return byState
    const aTime = (a.lastActivityAt ?? a.enrolledAt).getTime()
    const bTime = (b.lastActivityAt ?? b.enrolledAt).getTime()
    return bTime - aTime
  })
}
