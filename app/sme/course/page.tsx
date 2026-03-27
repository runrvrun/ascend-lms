import type { Metadata } from "next"
export const metadata: Metadata = { title: "My Topics — SME" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { SmeCourseList } from "./SmeCourseList"

export default async function SmeCoursesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string

  // Get topics where user is SME
  const smeTopics = await prisma.topicSME.findMany({
    where: { userId },
    include: {
      topic: {
        include: {
          courses: {
            where: { deletedAt: null },
            include: {
              _count: { select: { contents: { where: { deletedAt: null } } } },
              test: { where: { deletedAt: null }, select: { id: true } },
              assignment: { where: { deletedAt: null }, select: { id: true } },
              trainers: { include: { user: { select: { id: true, name: true } } } },
            },
            orderBy: { name: "asc" },
          },
        },
      },
    },
    orderBy: { topic: { name: "asc" } },
  })

  const topics = smeTopics.map((st) => st.topic)

  const trainerUsers = await prisma.user.findMany({
    where: { deletedAt: null, roles: { some: { role: "TRAINER" } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <SmeCourseList topics={topics} trainerUsers={trainerUsers} />
    </main>
  )
}
