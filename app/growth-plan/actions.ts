"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { NotificationType } from "@prisma/client"

async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

export async function createGrowthPlan(title: string, pathwayId?: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  await prisma.growthPlan.create({
    data: { userId, title: title.trim(), pathwayId: pathwayId ?? null },
  })

  revalidatePath("/growth-plan")
  if (pathwayId) revalidatePath(`/pathways/${pathwayId}`)
}

export async function updateGrowthPlan(id: string, title: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  await prisma.growthPlan.update({
    where: { id, userId },
    data: { title: title.trim() },
  })

  revalidatePath("/growth-plan")
}

export async function deleteGrowthPlan(id: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  const item = await prisma.growthPlan.findUnique({ where: { id }, select: { userId: true, pathwayId: true } })
  if (item?.userId !== userId) throw new Error("Forbidden")

  await prisma.growthPlan.delete({ where: { id } })

  revalidatePath("/growth-plan")
  if (item.pathwayId) revalidatePath(`/pathways/${item.pathwayId}`)
}

export async function toggleGrowthPlanComplete(id: string, completed: boolean) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  const [item, learner] = await Promise.all([
    prisma.growthPlan.findUnique({
      where: { id, userId },
      select: { title: true, pathwayId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, devManagerId: true },
    }),
  ])

  await prisma.growthPlan.update({
    where: { id, userId },
    data: {
      completedAt: completed ? new Date() : null,
      confirmedAt: completed ? undefined : null,
      confirmedById: completed ? undefined : null,
    },
  })

  // Notify dev manager when marked complete
  if (completed && learner?.devManagerId && item) {
    await prisma.notification.create({
      data: {
        userId: learner.devManagerId,
        type: NotificationType.GROWTH_PLAN_COMPLETED,
        message: `${learner.name ?? "A professional"} completed a growth plan item: "${item.title}". Please confirm it.`,
        pathwayId: item.pathwayId ?? undefined,
        relatedUserId: userId,
      },
    })
  }

  revalidatePath("/growth-plan")
  if (item?.pathwayId) revalidatePath(`/pathways/${item.pathwayId}`)
}

export async function confirmGrowthPlan(id: string) {
  const session = await getSession()
  const confirmedById = (session.user as any).id as string

  const [item, confirmer] = await Promise.all([
    prisma.growthPlan.findUnique({
      where: { id },
      select: { userId: true, title: true, pathwayId: true },
    }),
    prisma.user.findUnique({
      where: { id: confirmedById },
      select: { name: true },
    }),
  ])

  await prisma.growthPlan.update({
    where: { id },
    data: { confirmedAt: new Date(), confirmedById },
  })

  // Notify learner that their item was confirmed
  if (item) {
    await prisma.notification.create({
      data: {
        userId: item.userId,
        type: NotificationType.GROWTH_PLAN_CONFIRMED,
        message: `${confirmer?.name ?? "Your development manager"} confirmed your growth plan item: "${item.title}".`,
        pathwayId: item.pathwayId ?? undefined,
      },
    })
  }

  revalidatePath("/growth-plan")
  if (item?.pathwayId) revalidatePath(`/pathways/${item.pathwayId}`)
}
