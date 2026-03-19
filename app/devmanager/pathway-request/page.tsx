import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { PathwayRequestList } from "./PathwayRequestList"

export default async function PathwayRequestPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const devManagerId = (session.user as any).id as string

  const requests = await prisma.pathwayEnrollment.findMany({
    where: {
      status: "PENDING",
      type: "USER_REQUEST",
      user: { devManagerId },
    },
    select: {
      id: true,
      note: true,
      user: { select: { name: true, email: true } },
      pathway: { select: { name: true, description: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pathway Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          {requests.length} pending request{requests.length !== 1 ? "s" : ""} from your team
        </p>
      </div>
      <PathwayRequestList requests={requests} />
    </main>
  )
}
