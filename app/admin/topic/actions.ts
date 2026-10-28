"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { requireAdmin } from "../../lib/permissions"

export async function createTopic(name: string) {
  await requireAdmin()
  await prisma.topic.create({ data: { name: name.trim() } })
  revalidatePath("/admin/topic")
}

export async function updateTopic(id: string, name: string) {
  await requireAdmin()
  await prisma.topic.update({ where: { id }, data: { name: name.trim() } })
  revalidatePath("/admin/topic")
}

export async function deleteTopic(id: string) {
  await requireAdmin()
  await prisma.topic.delete({ where: { id } })
  revalidatePath("/admin/topic")
}

export async function addTopicSME(topicId: string, userId: string) {
  await requireAdmin()
  await prisma.topicSME.create({ data: { topicId, userId } })
  revalidatePath("/admin/topic")
}

export async function removeTopicSME(topicId: string, userId: string) {
  await requireAdmin()
  await prisma.topicSME.delete({ where: { topicId_userId: { topicId, userId } } })
  revalidatePath("/admin/topic")
}
