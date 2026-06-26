import { NextResponse } from "next/server"
import * as xlsx from "xlsx"
import { prisma } from "../../../../lib/prisma"

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      email: true,
      division: true,
      title: true,
      office: { select: { name: true } },
      managers: {
        take: 1,
        select: { manager: { select: { email: true } } },
      },
      cohorts: {
        take: 1,
        select: { cohort: { select: { name: true } } },
      },
    },
  })

  const wb = xlsx.utils.book_new()

  const rows: (string | null)[][] = [
    ["Name", "Email", "Division", "Title", "Office", "Manager Email", "Cohort Name"],
    ...users.map((u) => [
      u.name ?? "",
      u.email ?? "",
      u.division,
      u.title,
      u.office?.name ?? "",
      u.managers[0]?.manager.email ?? "",
      u.cohorts[0]?.cohort.name ?? "",
    ]),
  ]

  const ws = xlsx.utils.aoa_to_sheet(rows)
  ws["!cols"] = [
    { wch: 25 },
    { wch: 32 },
    { wch: 12 },
    { wch: 20 },
    { wch: 24 },
    { wch: 32 },
    { wch: 28 },
  ]
  xlsx.utils.book_append_sheet(wb, ws, "Users")

  const validData = [
    ["Valid Divisions", "Valid Titles"],
    ["MSD", "ANALYST"],
    ["DXD", "ASSOCIATE"],
    ["ISD", "MANAGER"],
    ["SCD", "DIRECTOR"],
    ["SSD", "PARTNER"],
    ["OXD", "MANAGING_PARTNER"],
    ["OPD", ""],
    ["FIN", ""],
  ]
  const wsValid = xlsx.utils.aoa_to_sheet(validData)
  wsValid["!cols"] = [{ wch: 18 }, { wch: 20 }]
  xlsx.utils.book_append_sheet(wb, wsValid, "Valid Values")

  const buf: Uint8Array = xlsx.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="users-export.xlsx"',
    },
  })
}
