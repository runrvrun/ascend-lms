import type { PrismaClient } from "@prisma/client"

// Session roles. Only ADMIN is stored (UserRole); the rest come from what a user is
// assigned to, so the Manager / Trainer / SME / pathway areas appear as soon as an admin
// assigns someone and disappear when the last assignment is removed.
// Takes the client as an argument because the NextAuth route keeps its own PrismaClient.
export type AppRole = "ADMIN" | "MANAGER" | "TRAINER" | "SME" | "PATHWAY_OWNER"

export const ASSIGNMENT_COUNTS = {
  managedUsers: { where: { user: { deletedAt: null } } },
  trainerCourses: { where: { course: { deletedAt: null } } },
  smeTopics: true,
  ownedPathways: { where: { pathway: { deletedAt: null } } },
} as const

export type AssignmentCounts = {
  managedUsers: number
  trainerCourses: number
  smeTopics: number
  ownedPathways: number
}

export function deriveRoles(storedRoles: { role: string }[], counts: AssignmentCounts): AppRole[] {
  const roles: AppRole[] = []
  if (storedRoles.some((r) => r.role === "ADMIN")) roles.push("ADMIN")
  if (counts.managedUsers > 0) roles.push("MANAGER")
  if (counts.trainerCourses > 0) roles.push("TRAINER")
  if (counts.smeTopics > 0) roles.push("SME")
  if (counts.ownedPathways > 0) roles.push("PATHWAY_OWNER")
  return roles
}

// Returns null for missing or deactivated users.
export async function loadUserRoles(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      deletedAt: true,
      lastActiveAt: true,
      roles: { select: { role: true } },
      _count: { select: ASSIGNMENT_COUNTS },
    },
  })
  if (!user || user.deletedAt) return null
  return { roles: deriveRoles(user.roles, user._count), lastActiveAt: user.lastActiveAt }
}
