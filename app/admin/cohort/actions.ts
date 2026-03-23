"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"

export async function createCohort(name: string) {
  await prisma.cohort.create({ data: { name } })
  revalidatePath("/admin/cohort")
}

export async function updateCohort(id: string, name: string) {
  await prisma.cohort.update({ where: { id }, data: { name } })
  revalidatePath("/admin/cohort")
  revalidatePath(`/admin/cohort/${id}`)
}

export async function deleteCohort(id: string) {
  await prisma.cohort.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/cohort")
}

// ── Cohort Users ──────────────────────────────────────────────────────────────

export async function addUserToCohort(cohortId: string, userId: string) {
  await prisma.cohortUser.create({ data: { cohortId, userId } })
  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function addUsersToCohort(cohortId: string, userIds: string[]) {
  if (userIds.length === 0) return
  await prisma.cohortUser.createMany({
    data: userIds.map((userId) => ({ cohortId, userId })),
    skipDuplicates: true,
  })
  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function removeUserFromCohort(id: string, cohortId: string) {
  await prisma.cohortUser.delete({ where: { id } })
  revalidatePath(`/admin/cohort/${cohortId}`)
}

// ── Cohort Pathways ───────────────────────────────────────────────────────────

export async function addPathwayToCohort(cohortId: string, pathwayId: string) {
  await prisma.cohortPathway.create({ data: { cohortId, pathwayId } })
  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function removePathwayFromCohort(id: string, cohortId: string) {
  await prisma.cohortPathway.delete({ where: { id } })
  revalidatePath(`/admin/cohort/${cohortId}`)
}
