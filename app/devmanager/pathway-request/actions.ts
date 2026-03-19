"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"

async function getDevManagerId() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  return (session.user as any).id as string
}

export async function approveRequest(enrollmentId: string) {
  const devManagerId = await getDevManagerId()
  await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "APPROVED", approvedById: devManagerId },
  })
  revalidatePath("/devmanager/pathway-request")
  revalidatePath("/pathways")
  revalidatePath("/dashboard")
}

export async function rejectRequest(enrollmentId: string, rejectionReason: string) {
  await prisma.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "REJECTED", rejectionReason },
  })
  revalidatePath("/devmanager/pathway-request")
  revalidatePath("/pathways")
  revalidatePath("/dashboard")
}
