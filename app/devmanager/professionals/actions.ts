"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { NotificationType } from "@prisma/client"

export async function assignPathway(userId: string, pathwayId: string, deadline: string | null) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  const devManagerId = (session.user as any).id as string

  const [, manager, pathway] = await Promise.all([
    prisma.pathwayEnrollment.create({
      data: {
        userId,
        pathwayId,
        type: "ASSIGNED",
        status: "APPROVED",
        approvedById: devManagerId,
        deadline: deadline ? new Date(deadline) : null,
      },
    }),
    prisma.user.findUnique({ where: { id: devManagerId }, select: { name: true } }),
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
  ])

  await prisma.notification.create({
    data: {
      userId,
      type: "PATHWAY_ASSIGNED",
      message: `${manager?.name ?? "Your development manager"} assigned you to "${pathway?.name ?? "a pathway"}".`,
      pathwayId,
    },
  })

  revalidatePath("/devmanager/professionals")
  revalidatePath("/dashboard")
}

export async function confirmGrowthPlan(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
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

  revalidatePath("/devmanager/professionals")
  revalidatePath("/growth-plan")
}

export async function updateDeadline(enrollmentId: string, deadline: string | null) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: { deadline: deadline ? new Date(deadline) : null },
  })
  revalidatePath("/devmanager/professionals")
  revalidatePath("/dashboard")
}
