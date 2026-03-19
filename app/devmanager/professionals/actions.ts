"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"

export async function assignPathway(userId: string, pathwayId: string, deadline: string | null) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  const devManagerId = (session.user as any).id as string

  await prisma.pathwayEnrollment.create({
    data: {
      userId,
      pathwayId,
      type: "ASSIGNED",
      status: "APPROVED",
      approvedById: devManagerId,
      deadline: deadline ? new Date(deadline) : null,
    },
  })
  revalidatePath("/devmanager/professionals")
  revalidatePath("/dashboard")
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
