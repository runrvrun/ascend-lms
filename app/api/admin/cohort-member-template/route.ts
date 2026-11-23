import { NextResponse } from "next/server"
import * as xlsx from "xlsx"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = ((session?.user as any)?.roles as string[]) ?? []
  if (!session?.user || !roles.includes("ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const wb = xlsx.utils.book_new()

  const data = [
    ["Email"],
    ["member.one@example.com"],
    ["member.two@example.com"],
  ]
  const ws = xlsx.utils.aoa_to_sheet(data)
  ws["!cols"] = [{ wch: 36 }]
  xlsx.utils.book_append_sheet(wb, ws, "Members")

  const buf: Uint8Array = xlsx.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cohort-member-template.xlsx"',
    },
  })
}
