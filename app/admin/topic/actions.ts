"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"

export async function createTopic(name: string) {
  await prisma.topic.create({ data: { name: name.trim() } })
  revalidatePath("/admin/topic")
}

export async function updateTopic(id: string, name: string) {
  await prisma.topic.update({ where: { id }, data: { name: name.trim() } })
  revalidatePath("/admin/topic")
}

export async function deleteTopic(id: string) {
  await prisma.topic.delete({ where: { id } })
  revalidatePath("/admin/topic")
}

export async function addTopicSME(topicId: string, userId: string) {
  await prisma.topicSME.create({ data: { topicId, userId } })
  revalidatePath("/admin/topic")
}

export async function removeTopicSME(topicId: string, userId: string) {
  await prisma.topicSME.delete({ where: { topicId_userId: { topicId, userId } } })
  revalidatePath("/admin/topic")
}
