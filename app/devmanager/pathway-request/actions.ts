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
      user: { select: { name: true, email: true } },
      pathway: { select: { name: true } },
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
        user: { select: { name: true, email: true } },
        pathway: { select: { name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: devManagerId },
      select: { name: true },
    }),
  ])

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
