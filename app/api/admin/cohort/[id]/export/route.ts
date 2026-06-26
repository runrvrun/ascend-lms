import { NextResponse } from "next/server"
import * as xlsx from "xlsx"
import { prisma } from "../../../../../lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cohort = await prisma.cohort.findUnique({
    where: { id },
    select: {
      name: true,
      users: {
        select: {
          user: {
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
            },
          },
        },
      },
    },
  })

  if (!cohort) {
    return new NextResponse("Cohort not found", { status: 404 })
  }

  const wb = xlsx.utils.book_new()

  const rows: (string | null)[][] = [
    ["Name", "Email", "Division", "Title", "Office", "Manager Email", "Cohort Name"],
    ...cohort.users.map(({ user }) => [
      user.name ?? "",
      user.email ?? "",
      user.division,
      user.title,
      user.office?.name ?? "",
      user.managers[0]?.manager.email ?? "",
      cohort.name,
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
  const safeName = cohort.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()

  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}-members.xlsx"`,
    },
  })
}
