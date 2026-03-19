import { prisma } from "../../lib/prisma"
import { CourseManagement } from "./CourseManagement"

export default async function AdminCoursePage() {
  const courses = await prisma.course.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { contents: true, pathways: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <CourseManagement courses={courses} />
    </main>
  )
}
