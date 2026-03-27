import type { Metadata } from "next"
export const metadata: Metadata = { title: "Course Management" }

import { prisma } from "../../lib/prisma"
import { CourseManagement } from "./CourseManagement"

export default async function AdminCoursePage() {
  const [courses, trainerUsers] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { contents: true, pathways: true } },
        trainers: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: "TRAINER" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <CourseManagement courses={courses} trainerUsers={trainerUsers} />
    </main>
  )
}
