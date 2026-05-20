"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"

export type PathwayFormData = {
  name: string
  description: string
  requiresApproval: boolean
  tags: string[]
}

export async function createPathway(data: PathwayFormData) {
  await prisma.pathway.create({
    data: {
      name: data.name,
      description: data.description || null,
      requiresApproval: data.requiresApproval,
      tags: data.tags,
      status: "DRAFT",
    },
  })
  revalidatePath("/admin/pathway")
}

export async function updatePathway(id: string, data: PathwayFormData) {
  await prisma.pathway.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      requiresApproval: data.requiresApproval,
      tags: data.tags,
    },
  })
  revalidatePath("/admin/pathway")
}

export async function togglePathwayStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  await prisma.pathway.update({ where: { id }, data: { status } })
  revalidatePath("/admin/pathway")
  revalidatePath("/pathways")
}

export async function deletePathway(id: string) {
  await prisma.pathway.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  revalidatePath("/admin/pathway")
}

// ── Pathway Courses ───────────────────────────────────────────────────────────

export async function addCourseToPathway(pathwayId: string, courseId: string, order: number, points: number) {
  await prisma.pathwayCourse.create({ data: { pathwayId, courseId, order, points } })
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function updatePathwayCourse(id: string, pathwayId: string, order: number, points: number) {
  await prisma.pathwayCourse.update({ where: { id }, data: { order, points } })
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function removeCourseFromPathway(id: string, pathwayId: string) {
  await prisma.pathwayCourse.delete({ where: { id } })
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

// ── Pathway Enrollments ───────────────────────────────────────────────────────

export async function adminEnrollUsers(pathwayId: string, userIds: string[]) {
  if (userIds.length === 0) return
  await prisma.pathwayEnrollment.createMany({
    data: userIds.map((userId) => ({
      userId,
      pathwayId,
      type: "ASSIGNED" as const,
      status: "APPROVED" as const,
    })),
    skipDuplicates: true,
  })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}

export async function adminRemoveEnrollment(enrollmentId: string, pathwayId: string) {
  await prisma.pathwayEnrollment.delete({ where: { id: enrollmentId } })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
}

export async function adminAssignCohortToPathway(pathwayId: string, cohortId: string) {
  await prisma.cohortPathway.create({ data: { pathwayId, cohortId } })

  const [pathway, cohort] = await Promise.all([
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
    prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { name: true, users: { select: { userId: true } } },
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
  }

  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
  revalidatePath(`/admin/pathway`)
}

export async function adminRemoveCohortFromPathway(cohortPathwayId: string, pathwayId: string) {
  await prisma.cohortPathway.delete({ where: { id: cohortPathwayId } })
  revalidatePath(`/admin/pathway/${pathwayId}/enrollments`)
  revalidatePath(`/admin/pathway`)
}
