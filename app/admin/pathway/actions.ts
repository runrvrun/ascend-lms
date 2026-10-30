"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { pathwayAssignedEmail } from "../../lib/email"
import { sendEmails } from "../../lib/sendEmail"
import { parseDeadlineInput } from "../../lib/pathwayDeadline"
import { PathwayVisibility } from "@prisma/client"
import { MAX_FEATURED_PATHWAYS } from "../../lib/featuredPathways"
import { requireAdmin, requirePathwayManager } from "../../lib/permissions"

export type PathwayFormData = {
  name: string
  description: string
  visibility: PathwayVisibility
  tags: string[]
  // Only applied when an admin saves; owners can't change who owns a pathway.
  ownerIds?: string[]
}

export async function createPathway(data: PathwayFormData) {
  await requireAdmin()
  await prisma.pathway.create({
    data: {
      name: data.name,
      description: data.description || null,
      visibility: data.visibility,
      tags: data.tags,
      status: "DRAFT",
      owners: { create: (data.ownerIds ?? []).map((userId) => ({ userId })) },
    },
  })
  revalidatePath("/admin/pathway")
}

export async function updatePathway(id: string, data: PathwayFormData) {
  const user = await requirePathwayManager(id)
  if (user.roles.includes("ADMIN") && data.ownerIds) {
    await prisma.$transaction([
      prisma.pathwayOwner.deleteMany({ where: { pathwayId: id, userId: { notIn: data.ownerIds } } }),
      prisma.pathwayOwner.createMany({
        data: data.ownerIds.map((userId) => ({ pathwayId: id, userId })),
        skipDuplicates: true,
      }),
    ])
  }
  await prisma.pathway.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      visibility: data.visibility,
      tags: data.tags,
      // Hidden pathways aren't listed on /pathways, so they can't stay featured.
      ...(data.visibility === "HIDDEN" ? { featuredAt: null } : {}),
    },
  })
  revalidatePath("/admin/pathway")
  revalidatePath("/pathways")
}

export async function togglePathwayStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  await requirePathwayManager(id)
  await prisma.pathway.update({
    where: { id },
    data: { status, ...(status === "DRAFT" ? { featuredAt: null } : {}) },
  })
  revalidatePath("/admin/pathway")
  revalidatePath("/pathways")
}

// Deleting and duplicating are admin-only; owners manage a pathway but can't remove or copy it.
export async function deletePathway(id: string) {
  await requireAdmin()
  await prisma.pathway.update({
    where: { id },
    data: { deletedAt: new Date(), featuredAt: null },
  })
  revalidatePath("/admin/pathway")
  revalidatePath("/pathways")
}

// Errors are returned rather than thrown: thrown messages are redacted in production.
// Featuring is site-wide (it changes everyone's recommendations), so it stays admin-only.
export async function setPathwayFeatured(id: string, featured: boolean): Promise<{ error?: string }> {
  await requireAdmin()
  if (!featured) {
    await prisma.pathway.update({ where: { id }, data: { featuredAt: null } })
  } else {
    const pathway = await prisma.pathway.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, visibility: true },
    })
    if (!pathway) return { error: "Pathway not found." }
    if (pathway.status !== "PUBLISHED" || pathway.visibility === "HIDDEN") {
      return { error: "Only published, non-hidden pathways can be featured." }
    }
    const featuredCount = await prisma.pathway.count({
      where: { featuredAt: { not: null }, deletedAt: null, id: { not: id } },
    })
    if (featuredCount >= MAX_FEATURED_PATHWAYS) {
      return { error: `At most ${MAX_FEATURED_PATHWAYS} pathways can be featured. Unfeature one first.` }
    }
    await prisma.pathway.update({ where: { id }, data: { featuredAt: new Date() } })
  }
  revalidatePath("/admin/pathway")
  revalidatePath("/pathways")
  return {}
}

export async function duplicatePathway(id: string): Promise<{ error?: string }> {
  await requireAdmin()
  const source = await prisma.pathway.findFirst({
    where: { id, deletedAt: null },
    include: {
      // Pathways only hold published courses; don't carry over drafts from before that rule.
      courses: { where: { course: { deletedAt: null, status: "PUBLISHED" } }, orderBy: { order: "asc" } },
      owners: { select: { userId: true } },
    },
  })
  if (!source) return { error: "Pathway not found." }

  // One nested create so a failure can't leave a copy without its courses.
  await prisma.pathway.create({
    data: {
      name: `${source.name}-copy`,
      description: source.description,
      status: "DRAFT",
      visibility: source.visibility,
      tags: source.tags,
      owners: { create: source.owners.map((o) => ({ userId: o.userId })) },
      courses: {
        create: source.courses.map((c) => ({
          courseId: c.courseId,
          order: c.order,
          points: c.points,
          sectionTitle: c.sectionTitle,
        })),
      },
    },
  })

  revalidatePath("/admin/pathway")
  return {}
}

// ── Pathway Courses ───────────────────────────────────────────────────────────

const touchPathway = (pathwayId: string) =>
  prisma.pathway.update({ where: { id: pathwayId }, data: { updatedAt: new Date() } })

export async function addCourseToPathway(
  pathwayId: string,
  courseId: string,
  order: number,
  points: number
): Promise<{ error?: string }> {
  await requirePathwayManager(pathwayId)
  // Pathways only hold published courses (see toggleCourseStatus in app/admin/course/actions.ts).
  const course = await prisma.course.findFirst({ where: { id: courseId, deletedAt: null }, select: { status: true } })
  if (course?.status !== "PUBLISHED") return { error: "Only published courses can be added to a pathway." }
  await Promise.all([
    prisma.pathwayCourse.create({ data: { pathwayId, courseId, order, points } }),
    touchPathway(pathwayId),
  ])
  revalidatePath(`/admin/pathway/${pathwayId}`)
  return {}
}

export async function updatePathwayCourse(id: string, pathwayId: string, order: number, points: number) {
  await requirePathwayManager(pathwayId)
  await Promise.all([
    prisma.pathwayCourse.update({ where: { id, pathwayId }, data: { order, points } }),
    touchPathway(pathwayId),
  ])
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function updateSectionTitle(id: string, pathwayId: string, sectionTitle: string | null) {
  await requirePathwayManager(pathwayId)
  await Promise.all([
    prisma.pathwayCourse.update({ where: { id, pathwayId }, data: { sectionTitle } }),
    touchPathway(pathwayId),
  ])
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function removeCourseFromPathway(id: string, pathwayId: string) {
  await requirePathwayManager(pathwayId)
  await Promise.all([
    prisma.pathwayCourse.delete({ where: { id, pathwayId } }),
    touchPathway(pathwayId),
  ])
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function swapPathwayCourseOrder(
  id1: string, order1: number,
  id2: string, order2: number,
  pathwayId: string,
) {
  await requirePathwayManager(pathwayId)
  await prisma.$transaction([
    prisma.pathwayCourse.update({ where: { id: id1, pathwayId }, data: { order: -1 } }),
    prisma.pathwayCourse.update({ where: { id: id2, pathwayId }, data: { order: order1 } }),
    prisma.pathwayCourse.update({ where: { id: id1, pathwayId }, data: { order: order2 } }),
    prisma.pathway.update({ where: { id: pathwayId }, data: { updatedAt: new Date() } }),
  ])
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

// ── Pathway Enrollments ───────────────────────────────────────────────────────

export async function adminEnrollUsers(pathwayId: string, userIds: string[], deadlineInput: string | null = null) {
  await requirePathwayManager(pathwayId)
  if (userIds.length === 0) return
  const deadline = parseDeadlineInput(deadlineInput)
  await prisma.pathwayEnrollment.createMany({
    data: userIds.map((userId) => ({
      userId,
      pathwayId,
      type: "ASSIGNED" as const,
      status: "APPROVED" as const,
      deadline,
    })),
    skipDuplicates: true,
  })

  const [pathway, users] = await Promise.all([
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
  ])

  if (pathway) {
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "PATHWAY_ASSIGNED" as const,
        message: `You have been assigned to "${pathway.name}".`,
        pathwayId,
      })),
      skipDuplicates: true,
    })

    await sendEmails(
      users.flatMap((u) =>
        u.email ? [pathwayAssignedEmail(u.email, u.name ?? u.email, pathway.name, pathwayId, undefined, deadline)] : []
      ),
      { bulk: true }
    )
  }

  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}

export async function adminRemoveEnrollment(enrollmentId: string, pathwayId: string) {
  await requirePathwayManager(pathwayId)
  await prisma.pathwayEnrollment.delete({ where: { id: enrollmentId, pathwayId } })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}

export async function adminAssignCohortToPathway(pathwayId: string, cohortId: string, deadlineInput: string | null = null) {
  await requirePathwayManager(pathwayId)
  const deadline = parseDeadlineInput(deadlineInput)
  await prisma.cohortPathway.create({ data: { pathwayId, cohortId, deadline } })

  const [pathway, cohort] = await Promise.all([
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
    prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { name: true, users: { select: { userId: true, user: { select: { name: true, email: true } } } } },
    }),
  ])

  if (pathway && cohort && cohort.users.length > 0) {
    await prisma.pathwayEnrollment.createMany({
      data: cohort.users.map((u) => ({
        userId: u.userId,
        pathwayId,
        cohortId,
        type: "ASSIGNED" as const,
        status: "APPROVED" as const,
        deadline,
      })),
      skipDuplicates: true,
    })

    await prisma.notification.createMany({
      data: cohort.users.map((u) => ({
        userId: u.userId,
        type: "COHORT_PATHWAY_ASSIGNED" as const,
        message: `A new pathway "${pathway.name}" has been assigned to your cohort "${cohort.name}".`,
        pathwayId,
      })),
      skipDuplicates: true,
    })

    await sendEmails(
      cohort.users.flatMap(({ user }) =>
        user.email ? [pathwayAssignedEmail(user.email, user.name ?? user.email, pathway.name, pathwayId, cohort.name, deadline)] : []
      ),
      { bulk: true }
    )
  }

  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
  revalidatePath(`/admin/pathway`)
}

export async function adminUpdateEnrollmentDeadline(enrollmentId: string, pathwayId: string, deadlineInput: string | null) {
  await requirePathwayManager(pathwayId)
  await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId, pathwayId },
    data: { deadline: parseDeadlineInput(deadlineInput) },
  })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
  revalidatePath(`/pathways/${pathwayId}`)
}

// Updates the cohort's deadline and every enrollment that came in through this cohort.
export async function adminUpdateCohortDeadline(cohortPathwayId: string, pathwayId: string, deadlineInput: string | null) {
  await requirePathwayManager(pathwayId)
  const deadline = parseDeadlineInput(deadlineInput)
  const cohortPathway = await prisma.cohortPathway.update({
    where: { id: cohortPathwayId, pathwayId },
    data: { deadline },
    select: { cohortId: true },
  })
  await prisma.pathwayEnrollment.updateMany({
    where: { pathwayId, cohortId: cohortPathway.cohortId },
    data: { deadline },
  })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
  revalidatePath(`/pathways/${pathwayId}`)
}

export async function adminRemoveCohortFromPathway(cohortPathwayId: string, pathwayId: string) {
  await requirePathwayManager(pathwayId)
  await prisma.cohortPathway.delete({ where: { id: cohortPathwayId, pathwayId } })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
  revalidatePath(`/admin/pathway`)
}

// ── Pathway Reminders ─────────────────────────────────────────────────────────

function assertOnTheHour(scheduledAt: Date) {
  // Use UTC getters so this check doesn't depend on the server process's local
  // timezone — it only assumes the admin's own timezone has a whole-hour UTC
  // offset (true for Singapore/Japan), which the client-side picker relies on too.
  if (scheduledAt.getUTCMinutes() !== 0 || scheduledAt.getUTCSeconds() !== 0 || scheduledAt.getUTCMilliseconds() !== 0) {
    throw new Error("Reminders can only be scheduled on the hour.")
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Reminder time must be in the future.")
  }
}

export async function adminAddEnrollmentReminder(
  enrollmentId: string,
  pathwayId: string,
  scheduledAt: Date,
  message?: string
) {
  await requirePathwayManager(pathwayId)
  assertOnTheHour(scheduledAt)
  await prisma.pathwayEnrollment.findUniqueOrThrow({ where: { id: enrollmentId, pathwayId }, select: { id: true } })
  await prisma.pathwayReminder.create({
    data: { enrollmentId, pathwayId, scheduledAt, message: message || null },
  })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}

export async function adminAddCohortReminder(
  cohortPathwayId: string,
  pathwayId: string,
  scheduledAt: Date,
  message?: string
) {
  await requirePathwayManager(pathwayId)
  assertOnTheHour(scheduledAt)
  await prisma.cohortPathway.findUniqueOrThrow({ where: { id: cohortPathwayId, pathwayId }, select: { id: true } })
  await prisma.pathwayReminder.create({
    data: { cohortPathwayId, pathwayId, scheduledAt, message: message || null },
  })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}

export async function adminDeleteReminder(reminderId: string, pathwayId: string) {
  await requirePathwayManager(pathwayId)
  await prisma.pathwayReminder.delete({ where: { id: reminderId, pathwayId } })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}
