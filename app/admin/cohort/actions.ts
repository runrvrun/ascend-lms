"use server"

import { revalidatePath } from "next/cache"
import * as xlsx from "xlsx"
import { prisma } from "../../lib/prisma"

export type BulkAddMembersResult = {
  added: number
  alreadyMember: string[]
  notFound: string[]
  errors: { row: number; message: string }[]
}

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

async function enrollUsersInCohortPathways(cohortId: string, userIds: string[]) {
  if (userIds.length === 0) return

  const cohortPathways = await prisma.cohortPathway.findMany({
    where: { cohortId },
    select: { pathwayId: true, pathway: { select: { name: true } } },
  })
  if (cohortPathways.length === 0) return

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { name: true },
  })
  if (!cohort) return

  await prisma.pathwayEnrollment.createMany({
    data: cohortPathways.flatMap(({ pathwayId }) =>
      userIds.map((userId) => ({
        userId,
        pathwayId,
        cohortId,
        type: "ASSIGNED" as const,
        status: "APPROVED" as const,
      }))
    ),
    skipDuplicates: true,
  })

  await prisma.notification.createMany({
    data: cohortPathways.flatMap(({ pathwayId, pathway }) =>
      userIds.map((userId) => ({
        userId,
        type: "COHORT_PATHWAY_ASSIGNED" as const,
        message: `A new pathway "${pathway.name}" has been assigned to your cohort "${cohort.name}".`,
        pathwayId,
      }))
    ),
    skipDuplicates: true,
  })
}

export async function addUserToCohort(cohortId: string, userId: string) {
  await prisma.cohortUser.create({ data: { cohortId, userId } })
  await enrollUsersInCohortPathways(cohortId, [userId])
  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function addUsersToCohort(cohortId: string, userIds: string[]) {
  if (userIds.length === 0) return
  await prisma.cohortUser.createMany({
    data: userIds.map((userId) => ({ cohortId, userId })),
    skipDuplicates: true,
  })
  await enrollUsersInCohortPathways(cohortId, userIds)
  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function removeUserFromCohort(id: string, cohortId: string) {
  const cohortUser = await prisma.cohortUser.findUnique({
    where: { id },
    select: { userId: true },
  })

  await prisma.cohortUser.delete({ where: { id } })

  if (cohortUser) {
    const cohortPathways = await prisma.cohortPathway.findMany({
      where: { cohortId },
      select: { pathwayId: true },
    })

    if (cohortPathways.length > 0) {
      await prisma.pathwayEnrollment.deleteMany({
        where: {
          userId: cohortUser.userId,
          pathwayId: { in: cohortPathways.map((cp) => cp.pathwayId) },
          cohortId,
        },
      })
    }
  }

  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function bulkAddMembersToCohort(
  cohortId: string,
  formData: FormData
): Promise<BulkAddMembersResult> {
  const file = formData.get("file") as File | null
  if (!file) throw new Error("No file provided")

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = xlsx.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

  const existingMembers = await prisma.cohortUser.findMany({
    where: { cohortId },
    select: { userId: true },
  })
  const memberUserIds = new Set(existingMembers.map((m) => m.userId))

  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } })
  const emailToId = new Map(
    allUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id])
  )

  const toAdd: string[] = []
  const alreadyMember: string[] = []
  const notFound: string[] = []
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    const email = String(row["Email"] ?? "").trim().toLowerCase()

    if (!email) {
      errors.push({ row: rowNum, message: "Email is required" })
      continue
    }

    const userId = emailToId.get(email)
    if (!userId) {
      notFound.push(email)
      continue
    }

    if (memberUserIds.has(userId)) {
      alreadyMember.push(email)
      continue
    }

    toAdd.push(userId)
    memberUserIds.add(userId)
  }

  if (toAdd.length > 0) {
    await prisma.cohortUser.createMany({
      data: toAdd.map((userId) => ({ cohortId, userId })),
      skipDuplicates: true,
    })
    await enrollUsersInCohortPathways(cohortId, toAdd)
    revalidatePath(`/admin/cohort/${cohortId}`)
  }

  return { added: toAdd.length, alreadyMember, notFound, errors }
}

// ── Cohort Pathways ───────────────────────────────────────────────────────────

export async function addPathwayToCohort(cohortId: string, pathwayId: string) {
  await prisma.cohortPathway.create({ data: { cohortId, pathwayId } })

  const [cohort, pathway] = await Promise.all([
    prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { name: true, users: { select: { userId: true } } },
    }),
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
  ])

  if (cohort && pathway && cohort.users.length > 0) {
    // Auto-enroll all cohort members (skip those already enrolled in this pathway)
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

  revalidatePath(`/admin/cohort/${cohortId}`)
}

export async function removePathwayFromCohort(id: string, cohortId: string) {
  await prisma.cohortPathway.delete({ where: { id } })
  revalidatePath(`/admin/cohort/${cohortId}`)
}
