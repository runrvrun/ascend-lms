"use server"

import { getServerSession } from "next-auth"
import { revalidatePath } from "next/cache"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"

const userSelect = { select: { id: true, name: true, image: true } } as const
const replyToSelect = { select: { id: true, name: true } } as const

export async function getComments(contentId: string, pathwayId: string) {
  return prisma.comment.findMany({
    where: { contentId, pathwayId, parentId: null, deletedAt: null },
    include: {
      user: userSelect,
      replies: {
        where: { deletedAt: null },
        include: {
          user: userSelect,
          replyToUser: replyToSelect,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  })
}

export async function postComment(
  contentId: string,
  pathwayId: string,
  body: string,
  parentId: string | null,
  replyToUserId: string | null
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Unauthorized")
  const userId = (session.user as any).id as string

  const comment = await prisma.comment.create({
    data: { contentId, pathwayId, userId, parentId, replyToUserId, body },
  })

  // Notifications
  const toNotify = new Set<string>()

  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    })
    if (parent && parent.userId !== userId) toNotify.add(parent.userId)
  }

  if (replyToUserId && replyToUserId !== userId) toNotify.add(replyToUserId)

  if (toNotify.size > 0) {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const content = await prisma.content.findUnique({ where: { id: contentId }, select: { title: true } })
    const message = `${actor?.name ?? "Someone"} replied to your comment in "${content?.title ?? "a content"}"`

    await prisma.notification.createMany({
      data: Array.from(toNotify).map((uid) => ({
        userId: uid,
        type: "COMMENT_REPLY" as const,
        message,
        commentId: comment.id,
        pathwayId,
      })),
    })
  }

  revalidatePath(`/pathways`)
}

export async function getNotifications() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return []
  const userId = (session.user as any).id as string

  return prisma.notification.findMany({
    where: { userId },
    include: {
      comment: {
        include: {
          user: userSelect,
          content: { select: { title: true } },
          pathway: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function markAllNotificationsRead() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return
  const userId = (session.user as any).id as string
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
  revalidatePath("/notifications")
}

export async function markNotificationRead(id: string) {
  await prisma.notification.update({ where: { id }, data: { read: true } })
  revalidatePath("/notifications")
}
