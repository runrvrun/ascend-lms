import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { Users } from "lucide-react"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { normalizeCheckInCode } from "../../lib/inPersonAttendance"
import { CheckInButton } from "./CheckInButton"

export const metadata: Metadata = { title: "Session Check-in" }

// Where a printed session QR code leads. Sign in first (back here afterwards), then
// one tap records attendance.
export default async function CheckInPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect(`/?callbackUrl=${encodeURIComponent(`/check-in/${code}`)}`)

  const content = await prisma.content.findFirst({
    where: { checkInCode: normalizeCheckInCode(code), deletedAt: null, type: "IN_PERSON", course: { deletedAt: null } },
    select: { title: true, course: { select: { name: true } } },
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {content ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100">
              <Users size={22} className="text-green-700" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">In Person Session</p>
            <h1 className="mt-1 text-lg font-bold text-slate-900">{content.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{content.course.name}</p>
            <div className="mt-6">
              <CheckInButton code={code} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Check-in code not found</h1>
            <p className="mt-2 text-sm text-slate-500">This QR code doesn&apos;t match a session. Ask your trainer for the right one.</p>
            <a href="/dashboard" className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline">Go to Ascend</a>
          </>
        )}
      </div>
    </main>
  )
}
