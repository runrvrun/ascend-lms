import type { Metadata } from "next"
export const metadata: Metadata = { title: "Topic Management" }

import { prisma } from "../../lib/prisma"
import { TopicManagement } from "./TopicManagement"

export default async function AdminTopicPage() {
  const [topics, allUsers] = await Promise.all([
    prisma.topic.findMany({
      include: {
        smes: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { courses: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: "SME" } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <TopicManagement topics={topics} allUsers={allUsers} />
    </main>
  )
}
