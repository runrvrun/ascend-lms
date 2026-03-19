"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"

export async function createOffice(name: string) {
  await prisma.office.create({ data: { name } })
  revalidatePath("/admin/office")
}

export async function updateOffice(id: string, name: string) {
  await prisma.office.update({ where: { id }, data: { name } })
  revalidatePath("/admin/office")
}

export async function deleteOffice(id: string) {
  await prisma.office.delete({ where: { id } })
  revalidatePath("/admin/office")
}

export async function assignUsersToOffice(officeId: string, userIds: string[]) {
  if (userIds.length === 0) return
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { officeId },
  })
  revalidatePath("/admin/office")
}

export async function removeUserFromOffice(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { officeId: null },
  })
  revalidatePath("/admin/office")
}
