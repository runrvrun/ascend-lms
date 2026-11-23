import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import QRCode from "qrcode"
import { ensureCheckInCode, formatCheckInCode, requireAttendanceManager } from "../../../lib/inPersonAttendance"
import { prisma } from "../../../lib/prisma"
import { PrintButton } from "./PrintButton"

export const metadata: Metadata = { title: "Check-in QR Code" }

// A printable page with the session's permanent check-in QR code, for admins and the
// course's trainers to print and pass around the room.
export default async function CheckInPrintPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params
  let content: { id: string; courseId: string; title: string }
  try {
    ;({ content } = await requireAttendanceManager(contentId))
  } catch {
    redirect("/dashboard")
  }
  const course = await prisma.course.findUnique({ where: { id: content.courseId }, select: { name: true } })
  const code = await ensureCheckInCode(content.id)

  // NEXTAUTH_URL is the app's public address on every server; fall back to the request.
  const h = await headers()
  const origin = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`
  const url = `${origin}/check-in/${code}`
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center bg-white p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Attendance check-in</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{content.title}</h1>
      <p className="mt-1 text-lg text-slate-500">{course?.name}</p>
      <div className="mt-8 w-full max-w-sm" dangerouslySetInnerHTML={{ __html: svg }} />
      <ol className="mt-8 space-y-1 text-left text-base text-slate-700">
        <li>1. Scan this code with your phone camera.</li>
        <li>2. Sign in to Ascend if asked.</li>
        <li>3. Tap <span className="font-semibold">Check in to this session</span>.</li>
      </ol>
      <p className="mt-6 text-sm text-slate-500">
        No camera? Open the session in Ascend and enter the code{" "}
        <span className="font-mono text-base font-bold tracking-wider text-slate-900">{formatCheckInCode(code)}</span>
      </p>
      <PrintButton />
    </main>
  )
}
