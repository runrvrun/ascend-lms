import { NextResponse } from "next/server"
import * as xlsx from "xlsx"

export async function GET() {
  const wb = xlsx.utils.book_new()

  // ── Users sheet ─────────────────────────────────────────────────────────────
  const usersData = [
    ["Name", "Email", "Division", "Title", "Office", "Dev Manager Email", "Cohort Name"],
    ["Jane Doe", "jane.doe@example.com", "MSD", "ANALYST", "YCP Indonesia", "manager@example.com", ""],
  ]
  const wsUsers = xlsx.utils.aoa_to_sheet(usersData)
  wsUsers["!cols"] = [
    { wch: 25 },
    { wch: 32 },
    { wch: 12 },
    { wch: 20 },
    { wch: 24 },
    { wch: 32 },
    { wch: 28 },
  ]
  xlsx.utils.book_append_sheet(wb, wsUsers, "Users")

  // ── Valid Values sheet ───────────────────────────────────────────────────────
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

  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="user-import-template.xlsx"',
    },
  })
}
