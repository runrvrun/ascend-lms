"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { NotificationType } from "@prisma/client"
import { pathwayAssignedEmail } from "../../lib/email"
import { sendEmails } from "../../lib/sendEmail"
import { requireManagerOf } from "../../lib/permissions"

export async function assignPathway(userId: string, pathwayId: string, deadline: string | null) {
  const { id: managerId } = await requireManagerOf(userId)
  const target = await prisma.pathway.findFirst({ where: { id: pathwayId, deletedAt: null }, select: { id: true } })
  if (!target) throw new Error("Pathway not found")

  const [, manager, pathway, user] = await Promise.all([
    prisma.pathwayEnrollment.create({
      data: {
        userId,
        pathwayId,
        type: "ASSIGNED",
        status: "APPROVED",
        approvedById: managerId,
        deadline: deadline ? new Date(deadline) : null,
      },
    }),
    prisma.user.findUnique({ where: { id: managerId }, select: { name: true } }),
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ])

  await prisma.notification.create({
    data: {
      userId,
      type: "PATHWAY_ASSIGNED",
      message: `${manager?.name ?? "Your manager"} assigned you to "${pathway?.name ?? "a pathway"}".`,
      pathwayId,
    },
  })

  if (user?.email && pathway) {
    await sendEmails([pathwayAssignedEmail(user.email, user.name ?? user.email, pathway.name, pathwayId)])
  }

  revalidatePath("/manager/professionals")
  revalidatePath("/dashboard")
}

export async function confirmGrowthPlan(id: string) {
  const item = await prisma.growthPlan.findUnique({
    where: { id },
    select: { userId: true, title: true, pathwayId: true, completedAt: true },
  })
  if (!item) throw new Error("Growth plan item not found")
  const { id: confirmedById } = await requireManagerOf(item.userId)
  if (!item.completedAt) throw new Error("Only a completed goal can be confirmed.")
  const confirmer = await prisma.user.findUnique({ where: { id: confirmedById }, select: { name: true } })

  await prisma.growthPlan.update({
    where: { id },
    data: { confirmedAt: new Date(), confirmedById },
  })

  {
    await prisma.notification.create({
      data: {
        userId: item.userId,
        type: NotificationType.GROWTH_PLAN_CONFIRMED,
        message: `${confirmer?.name ?? "Your manager"} confirmed your growth plan item: "${item.title}".`,
        pathwayId: item.pathwayId ?? undefined,
      },
    })
  }

  revalidatePath("/manager/professionals")
  revalidatePath("/growth-plan")
}

export async function updateDeadline(enrollmentId: string, deadline: string | null) {
  const enrollment = await prisma.pathwayEnrollment.findUnique({ where: { id: enrollmentId }, select: { userId: true } })
  if (!enrollment) throw new Error("Enrollment not found")
  await requireManagerOf(enrollment.userId)
  await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: { deadline: deadline ? new Date(deadline) : null },
  })
  revalidatePath("/manager/professionals")
  revalidatePath("/dashboard")
}
