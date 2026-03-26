"use server"

import bcrypt from "bcryptjs"
import { prisma } from "../../lib/prisma"

export async function activateAccount(token: string, password: string): Promise<{ error?: string }> {
  if (!token) return { error: "Invalid activation link." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }

  const user = await prisma.user.findFirst({
    where: { activationToken: token },
    select: { id: true, activationTokenExpiry: true },
  })

  if (!user) return { error: "This activation link is invalid or has already been used." }
  if (!user.activationTokenExpiry || user.activationTokenExpiry < new Date()) {
    return { error: "This activation link has expired. Ask your admin to resend it." }
  }

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      activationToken: null,
      activationTokenExpiry: null,
    },
  })

  return {}
}
