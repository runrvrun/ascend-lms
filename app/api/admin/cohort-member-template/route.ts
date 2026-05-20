import { NextResponse } from "next/server"
import * as xlsx from "xlsx"

export async function GET() {
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

  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cohort-member-template.xlsx"',
    },
  })
}
