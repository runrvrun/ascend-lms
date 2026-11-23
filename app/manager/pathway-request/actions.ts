"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { enrollmentApprovedEmail, enrollmentRejectedEmail } from "../../lib/email"
import { sendEmails } from "../../lib/sendEmail"
import { requireManagerOf } from "../../lib/permissions"

// The caller must manage the requester (or be an Admin), and the request must still be pending.
async function getManagerId(enrollmentId: string) {
  const enrollment = await prisma.pathwayEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { userId: true, status: true },
  })
  if (!enrollment || enrollment.status !== "PENDING") throw new Error("This request is no longer pending.")
  const { id } = await requireManagerOf(enrollment.userId)
  return id
}

export async function approveRequest(enrollmentId: string) {
  const managerId = await getManagerId(enrollmentId)

  const enrollment = await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "APPROVED", approvedById: managerId },
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

  revalidatePath("/manager/pathway-request")
  revalidatePath("/pathways")
  revalidatePath("/dashboard")

  if (enrollment.user.email) {
    await sendEmails([
      enrollmentApprovedEmail(enrollment.user.email, enrollment.user.name ?? enrollment.user.email, enrollment.pathway.name),
    ])
  }
}

export async function rejectRequest(enrollmentId: string, rejectionReason: string) {
  const managerId = await getManagerId(enrollmentId)

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
      where: { id: managerId },
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

  revalidatePath("/manager/pathway-request")
  revalidatePath("/pathways")
  revalidatePath("/dashboard")

  if (enrollment.user.email) {
    await sendEmails([
      enrollmentRejectedEmail(
        enrollment.user.email,
        enrollment.user.name ?? enrollment.user.email,
        enrollment.pathway.name,
        rejectionReason,
        manager?.name ?? "your manager"
      ),
    ])
  }
}
