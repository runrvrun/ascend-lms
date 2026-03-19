"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"

export type PathwayFormData = {
  name: string
  description: string
  requiresApproval: boolean
  tags: string[]
}

export async function createPathway(data: PathwayFormData) {
  await prisma.pathway.create({
    data: {
      name: data.name,
      description: data.description || null,
      requiresApproval: data.requiresApproval,
      tags: data.tags,
    },
  })
  revalidatePath("/admin/pathway")
}

export async function updatePathway(id: string, data: PathwayFormData) {
  await prisma.pathway.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      requiresApproval: data.requiresApproval,
      tags: data.tags,
    },
  })
  revalidatePath("/admin/pathway")
}

export async function deletePathway(id: string) {
  await prisma.pathway.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  revalidatePath("/admin/pathway")
}

// ── Pathway Courses ───────────────────────────────────────────────────────────

export async function addCourseToPathway(pathwayId: string, courseId: string, order: number, points: number) {
  await prisma.pathwayCourse.create({ data: { pathwayId, courseId, order, points } })
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function updatePathwayCourse(id: string, pathwayId: string, order: number, points: number) {
  await prisma.pathwayCourse.update({ where: { id }, data: { order, points } })
  revalidatePath(`/admin/pathway/${pathwayId}`)
}

export async function removeCourseFromPathway(id: string, pathwayId: string) {
  await prisma.pathwayCourse.delete({ where: { id } })
  revalidatePath(`/admin/pathway/${pathwayId}`)
}
