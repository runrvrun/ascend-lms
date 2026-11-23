// One-off/occasional import of HUB's employee export (HUB → Professionals → export,
// an .xlsx with Email, Office, Region, Join Date, Division, Job Title, Type columns).
// Matches rows to Ascend users by email and updates job title, division and office
// (only where HUB's value maps to an Ascend one — see app/lib/hubMapping.ts; HUB's
// "NA" title never overwrites) plus region, employment type and join date (a blank
// HUB value leaves the Ascend one alone). Deactivated users are updated too.
//
//   npx tsx --env-file=.env scripts/import-hub-employees.ts <file.xlsx> [--dry-run]
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as xlsx from "xlsx"
import { buildHubOfficeMatcher, mapHubValues } from "../app/lib/hubMapping"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const DRY_RUN = process.argv.includes("--dry-run")
// Users updated per SQL statement, so a remote DB isn't hit once per user.
const BATCH_SIZE = 200

// One user's changes; a null field is left as it is.
type UserChange = {
  id: string
  title: string | null
  division: string | null
  officeId: string | null
  region: string | null
  employmentType: string | null
  joinDate: string | null // yyyy-mm-dd
}

// Applies a batch in one UPDATE … FROM unnest(…) statement. COALESCE keeps the
// current value wherever the change is null.
async function applyBatch(batch: UserChange[]) {
  const col = <K extends keyof UserChange>(k: K) => batch.map((c) => c[k])
  return prisma.$executeRaw`
    UPDATE "User" AS u SET
      "title"          = COALESCE(v.title::"JobTitle", u."title"),
      "division"       = COALESCE(v.division::"Division", u."division"),
      "officeId"       = COALESCE(v.office_id, u."officeId"),
      "region"         = COALESCE(v.region, u."region"),
      "employmentType" = COALESCE(v.employment_type, u."employmentType"),
      "joinDate"       = COALESCE(v.join_date::date, u."joinDate"),
      "updatedAt"      = now()
    FROM unnest(
      ${col("id")}::text[], ${col("title")}::text[], ${col("division")}::text[], ${col("officeId")}::text[],
      ${col("region")}::text[], ${col("employmentType")}::text[], ${col("joinDate")}::text[]
    ) AS v(id, title, division, office_id, region, employment_type, join_date)
    WHERE u."id" = v.id`
}
const REQUIRED_COLUMNS = ["Email", "Office", "Region", "Join Date", "Division", "Job Title", "Type"]

// Join Date may be a text cell ("2026-04-01") or a real Excel date.
function cellText(value: unknown): string | null {
  if (value instanceof Date) {
    // Excel dates are local calendar days; read them back in local time.
    const p = (n: number) => String(n).padStart(2, "0")
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`
  }
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s || null
}

function tally(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function printTally(title: string, map: Map<string, number>) {
  if (map.size === 0) return
  console.log(`\n${title}:`)
  for (const [k, n] of [...map].sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${k}`)
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"))
  if (!file) throw new Error("Usage: import-hub-employees.ts <file.xlsx> [--dry-run]")

  const wb = xlsx.readFile(file, { cellDates: true })
  const rows: Record<string, unknown>[] = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  const missing = REQUIRED_COLUMNS.filter((c) => rows.length > 0 && !(c in rows[0]))
  if (rows.length === 0 || missing.length > 0) throw new Error(`Not a HUB employee export (missing columns: ${missing.join(", ") || "all rows"})`)

  const offices = await prisma.office.findMany({ select: { id: true, name: true } })
  const officeName = new Map(offices.map((o) => [o.id, o.name]))
  const matchOffice = buildHubOfficeMatcher(offices)
  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, title: true, division: true, officeId: true, region: true, employmentType: true, joinDate: true },
  })
  const userByEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u]))

  let notFound = 0
  let unchanged = 0
  const updates: UserChange[] = []
  const fieldCounts = new Map<string, number>()
  const titleChanges = new Map<string, number>()
  const divisionChanges = new Map<string, number>()
  const officeChanges = new Map<string, number>()
  const unmapped = new Map<string, number>()

  for (const row of rows) {
    const email = cellText(row["Email"])?.toLowerCase()
    const user = email ? userByEmail.get(email) : undefined
    if (!user) {
      notFound++
      continue
    }
    const m = mapHubValues(
      {
        jobTitle: cellText(row["Job Title"]),
        division: cellText(row["Division"]),
        office: cellText(row["Office"]),
        region: cellText(row["Region"]),
        employmentType: cellText(row["Type"]),
        joinDate: cellText(row["Join Date"]),
      },
      matchOffice
    )
    for (const u of m.unmapped) tally(unmapped, u)

    const change: UserChange = { id: user.id, title: null, division: null, officeId: null, region: null, employmentType: null, joinDate: null }
    if (m.title && m.title !== user.title) {
      change.title = m.title
      tally(titleChanges, `${user.title} → ${m.title}`)
    }
    if (m.division && m.division !== user.division) {
      change.division = m.division
      tally(divisionChanges, `${user.division} → ${m.division}`)
    }
    if (m.officeId && m.officeId !== user.officeId) {
      change.officeId = m.officeId
      tally(officeChanges, `${user.officeId ? officeName.get(user.officeId) : "(no office)"} → ${officeName.get(m.officeId)}`)
    }
    if (m.region && m.region !== user.region) change.region = m.region
    if (m.employmentType && m.employmentType !== user.employmentType) change.employmentType = m.employmentType
    if (m.joinDate && m.joinDate.getTime() !== user.joinDate?.getTime()) change.joinDate = m.joinDate.toISOString().slice(0, 10)

    const fields = (Object.keys(change) as (keyof UserChange)[]).filter((k) => k !== "id" && change[k] !== null)
    if (fields.length === 0) {
      unchanged++
      continue
    }
    for (const f of fields) tally(fieldCounts, f)
    updates.push(change)
  }

  if (!DRY_RUN) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      await applyBatch(batch)
      console.log(`  updated ${Math.min(i + BATCH_SIZE, updates.length)} of ${updates.length}`)
    }
  }
  const updated = updates.length

  printTally("Fields changed (users)", fieldCounts)
  printTally("Job title changes", titleChanges)
  printTally("Division changes", divisionChanges)
  printTally("Office changes", officeChanges)
  printTally("HUB values with no Ascend match (left as they were)", unmapped)
  console.log(
    `\nHUB import ${DRY_RUN ? "dry run " : ""}complete: ${rows.length} rows, ${updated} users ${DRY_RUN ? "would be " : ""}updated, ` +
      `${unchanged} already up to date, ${notFound} not in Ascend.`
  )
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
