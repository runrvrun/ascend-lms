import { getServerSession } from "next-auth"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { prisma } from "./prisma"

// Server actions must check permissions themselves: role-gated layouts only protect
// pages, and an action can be called directly by anyone who has its id.

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return {
    id: (session.user as any).id as string,
    roles: ((session.user as any).roles as string[]) ?? [],
  }
}

export async function requireAdmin() {
  const user = await getSessionUser()
  if (!user?.roles.includes("ADMIN")) throw new Error("Unauthorized")
  return user
}

export async function isPathwayOwner(userId: string, pathwayId: string) {
  const owner = await prisma.pathwayOwner.findUnique({
    where: { pathwayId_userId: { pathwayId, userId } },
    select: { userId: true },
  })
  return !!owner
}

// Admins manage every pathway; owners manage the pathways they own.
export async function canManagePathway(user: { id: string; roles: string[] }, pathwayId: string) {
  return user.roles.includes("ADMIN") || isPathwayOwner(user.id, pathwayId)
}

export async function requirePathwayManager(pathwayId: string) {
  const user = await getSessionUser()
  if (!user || !(await canManagePathway(user, pathwayId))) throw new Error("Unauthorized")
  return user
}

// For layouts/pages: admin-only sections under /admin (pathway owners are let into the
// /admin layout so they can reach /admin/pathway).
export async function requireAdminPage() {
  const user = await getSessionUser()
  if (!user) redirect("/")
  if (!user.roles.includes("ADMIN")) redirect("/dashboard")
  return user
}
