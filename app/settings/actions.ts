"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import bcrypt from "bcryptjs"

export async function changePassword(newPassword: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: "Not authenticated." }

  const userId = (session.user as any).id as string
  if (!userId) return { error: "Not authenticated." }

  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  return {}
}
