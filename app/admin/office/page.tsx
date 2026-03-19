import { prisma } from "../../lib/prisma"
import { OfficeManagement } from "./OfficeManagement"

export default async function AdminOfficePage() {
  const [offices, allUsers] = await Promise.all([
    prisma.office.findMany({
      include: {
        _count: { select: { users: true } },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            division: true,
            title: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        division: true,
        title: true,
        officeId: true,
      },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <OfficeManagement offices={offices} allUsers={allUsers} />
    </main>
  )
}
