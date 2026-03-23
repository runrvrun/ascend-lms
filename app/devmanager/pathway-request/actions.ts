"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { sendEnrollmentApproved, sendEnrollmentRejected } from "../../lib/email"

async function getDevManagerId() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  return (session.user as any).id as string
}

export async function approveRequest(enrollmentId: string) {
  const devManagerId = await getDevManagerId()

  const enrollment = await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "APPROVED", approvedById: devManagerId },
    select: {
      userId: true,
      pathwayId: true,
      user: { select: { name: true, email: true } },
      pathway: { select: { id: true, name: true } },
    },
  })

  await prisma.notification.create({
    data: {
      userId: enrollment.userId,
      type: "ENROLLMENT_APPROVED",
      message: `Your enrollment request for "${enrollment.pathway.name}" has been approved.`,
      pathwayId: enrollment.pathway.id,
    },
  })

  revalidatePath("/devmanager/pathway-request")
  revalidatePath("/pathways")
  revalidatePath("/dashboard")

  if (enrollment.user.email) {
    await sendEnrollmentApproved(
      enrollment.user.email,
      enrollment.user.name ?? enrollment.user.email,
      enrollment.pathway.name
    )
  }
}

export async function rejectRequest(enrollmentId: string, rejectionReason: string) {
  const devManagerId = await getDevManagerId()

  const [enrollment, manager] = await Promise.all([
    prisma.pathwayEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "REJECTED", rejectionReason },
      select: {
        userId: true,
        pathwayId: true,
        user: { select: { name: true, email: true } },
        pathway: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: devManagerId },
      select: { name: true },
    }),
  ])

  await prisma.notification.create({
    data: {
      userId: enrollment.userId,
      type: "ENROLLMENT_REJECTED",
      message: `Your enrollment request for "${enrollment.pathway.name}" was not approved. Reason: ${rejectionReason}`,
      pathwayId: enrollment.pathway.id,
    },
  })

  revalidatePath("/devmanager/pathway-request")
  revalidatePath("/pathways")
  revalidatePath("/dashboard")

  if (enrollment.user.email) {
    await sendEnrollmentRejected(
      enrollment.user.email,
      enrollment.user.name ?? enrollment.user.email,
      enrollment.pathway.name,
      rejectionReason,
      manager?.name ?? "your development manager"
    )
  }
}
