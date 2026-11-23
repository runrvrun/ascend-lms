// Maps M365 and HUB employee values onto Ascend's (Division, JobTitle, Office), shared
// by scripts/sync-m365-users.ts and scripts/import-hub-employees.ts. Kept free of the
// app/lib/prisma.ts singleton so scripts can import it.
import { Division, JobTitle } from "@prisma/client"

// M365 `department` values that don't match a Division name as-is.
const DEPARTMENT_ALIASES: Record<string, Division> = {
  "TCD/TALENT MANAGEMENT": Division.TCD,
  "TCD/TM": Division.TCD,
  FINANCE: Division.FIN,
}

const VALID_TITLES = new Set<string>(Object.values(JobTitle))

// Blank → NA; unrecognised → undefined.
export function mapDivision(department: string | null): Division | undefined {
  const key = department?.trim().toUpperCase()
  if (!key) return Division.NA
  if (DEPARTMENT_ALIASES[key]) return DEPARTMENT_ALIASES[key]
  // Enum values aren't all uppercase (e.g. `Contractor`), so match case-insensitively.
  return Object.values(Division).find((d) => d.toUpperCase() === key)
}

// M365 titles are either a plain title ("Team Lead") or a comma-separated list
// like "Group Officer, Managing Partner, Japan Regional CEO" — take the first
// part that names a JobTitle. Blank → NA; unrecognised → undefined.
export function mapJobTitle(jobTitle: string | null): JobTitle | undefined {
  if (!jobTitle?.trim()) return JobTitle.NA
  for (const part of jobTitle.split(",")) {
    const key = part.trim().toUpperCase().replace(/\s+/g, "_")
    if (VALID_TITLES.has(key)) return key as JobTitle
  }
  return undefined
}

// Ascend office names carry a region prefix ("SEA - YCP Singapore") that M365's
// officeLocation ("YCP Singapore") doesn't, so index each office under both.
export function officeKeys(name: string): string[] {
  const full = name.trim().toLowerCase()
  const unprefixed = full.replace(/^[a-z]+ - /, "")
  return unprefixed === full ? [full] : [full, unprefixed]
}

// HUB office (legal entity) name, lower case → Ascend office name. Worked out on
// 2026-11-23 by comparing HUB's employee export with the office each person already
// had in Ascend. HUB names not listed fall back to loose matching below; add any the
// sync or import reports as unmatched.
const HUB_OFFICE_ALIASES: Record<string, string> = {
  "auctus advisors private limited": "IN - YCP Auctus",
  "consus global inc.": "NA - Consus Canada",
  "consus global llc": "NA - Consus US",
  "consus global pvt. ltd": "IN - Consus India",
  "green impact labs, inc": "JP - Green Impact Labs, Inc",
  "pt ycp indonesia (jakarta)": "SEA - YCP Indonesia",
  "pt ycp indonesia (surabaya)": "SEA - YCP Indonesia",
  "renoir brasil": "NA - Renoir Brasil Ltda",
  "renoir esg": "ME - ESG Integrate Fze",
  "renoir holdings (singapore)": "SEA - Renoir Holdings Pte. Ltd",
  "renoir hong kong": "GC - Renoir Consulting (Hk) Private Limited",
  "renoir india": "IN - Renoir Management Consulting (India) Pvt Ltd",
  "renoir indonesia": "SEA - PT Renoir Consulting Indonesia",
  "renoir malaysia": "SEA - Renoir Consulting (Malaysia) Sdn Bhd",
  "renoir mauritius": "EU - Renoir Mauritius",
  "renoir middle east": "ME - Renoir Consulting Sole Proprietorship LLC",
  "renoir philippines": "SEA - Renoir Implementation Services Inc",
  "renoir singapore": "SEA - Renoir Consulting (Singapore) Pte Ltd",
  "renoir uk": "EU - Renoir Consulting (UK) Limited",
  "renoir us": "NA - Renoir Management Corporation",
  "renoir unison singapore": "SEA - Unison Mining Consulting Pte Ltd",
  "shenkuo france": "EU - Shenkuo France",
  "shenkuo hong kong": "GC - Shenkuo Hong Kong",
  "ycp (thailand) co., ltd.": "SEA - YCP Thailand",
  "ycp gr philippines inc.": "SEA - YCP Philippines",
  "ycp holdings (global) limited": "SEA - YCP Holdings (Singapore)",
  "ycp holdings (global) limited, representative office": "GC - YCP Holdings (Hong Kong)",
  "ycp hong kong limited (taiwan branch)": "GC - YCP Taiwan",
  "ycp hong kong limited": "GC - YCP Hong Kong",
  "ycp international b.v.": "EU - YCP Netherlands",
  "ycp japan, inc.": "JP - YCP Japan",
  "ycp malaysia sdn bhd": "SEA - YCP Malaysia",
  "ycp sg pte. ltd.": "SEA - YCP Singapore",
  "ycp shanghai limited": "GC - YCP Shanghai",
  "ycp solidiance limited": "NA - YCP US",
  "ycp vietnam company limited": "SEA - YCP Vietnam",
}

// Loose keys for a name: region prefix, punctuation and company suffixes dropped, first
// keeping and then dropping any "(…)" part.
function looseOfficeKeys(name: string): string[] {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/^[a-z]+ - /, "")
      .replace(/[^a-z0-9()]+/g, " ")
      .replace(/\b(pt|pte|ltd|limited|private|pvt|inc|llc|sdn|bhd|fze|ltda|corporation|sole proprietorship)\b/g, " ")
  const withParens = clean(name).replace(/[()]/g, " ").replace(/\s+/g, " ").trim()
  const withoutParens = clean(name).replace(/\([^)]*\)/g, " ").replace(/[()]/g, " ").replace(/\s+/g, " ").trim()
  return [...new Set([withParens, withoutParens])].filter(Boolean)
}

// Returns a function mapping a HUB office name to an Ascend office id: the alias list,
// then an exact name, then a loose key — but only one that a single office has.
export function buildHubOfficeMatcher(offices: { id: string; name: string }[]) {
  const exact = new Map(offices.flatMap((o) => officeKeys(o.name).map((k) => [k, o.id] as const)))
  const loose = new Map<string, string | null>() // null = ambiguous
  for (const o of offices) {
    for (const k of looseOfficeKeys(o.name)) loose.set(k, loose.has(k) && loose.get(k) !== o.id ? null : o.id)
  }
  const byName = new Map(offices.map((o) => [o.name.toLowerCase(), o.id]))
  return (hubName: string): string | undefined => {
    const key = hubName.trim().toLowerCase()
    const alias = HUB_OFFICE_ALIASES[key]
    if (alias) return byName.get(alias.toLowerCase())
    if (exact.has(key)) return exact.get(key)
    for (const k of looseOfficeKeys(hubName)) {
      const id = loose.get(k)
      if (id) return id
    }
    return undefined
  }
}

// HUB's export spells employment types out ("Full-Time Employee (FTE)"); its API may
// give just the code. Store the spelled-out form either way so the filter has one value.
const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FTE: "Full-Time Employee (FTE)",
  PBC: "Project-Based Contract (PBC)",
  FTC: "Fixed-Term Contract (FTC)",
}

export function normalizeEmploymentType(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  return EMPLOYMENT_TYPE_LABELS[v.toUpperCase()] ?? v
}

// A yyyy-MM-dd join date as UTC midnight (a @db.Date column); anything else → null.
export function parseJoinDate(value: string | null | undefined): Date | null {
  const v = value?.trim()
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  return isNaN(d.getTime()) ? null : d
}

export type HubValues = {
  jobTitle: string | null
  division: string | null
  office: string | null
  region: string | null
  employmentType: string | null
  joinDate: string | null
}

export type MappedHubValues = {
  // Undefined = HUB gave nothing usable; keep the current value.
  title?: JobTitle
  division?: Division
  officeId?: string
  region: string | null
  employmentType: string | null
  joinDate: Date | null
  // HUB values that didn't map to an Ascend one, for the log.
  unmapped: string[]
}

// HUB's "NA" title means unknown, so it never replaces a real one.
export function mapHubValues(hub: HubValues, matchOffice: (name: string) => string | undefined): MappedHubValues {
  const unmapped: string[] = []
  const titleText = hub.jobTitle?.trim()
  let title: JobTitle | undefined
  if (titleText && titleText.toUpperCase() !== "NA") {
    title = mapJobTitle(titleText)
    if (!title || title === JobTitle.NA) {
      title = undefined
      unmapped.push(`job title "${titleText}"`)
    }
  }
  const divisionText = hub.division?.trim()
  let division: Division | undefined
  if (divisionText && divisionText.toUpperCase() !== "NA") {
    division = mapDivision(divisionText)
    if (!division) unmapped.push(`division "${divisionText}"`)
  }
  const officeText = hub.office?.trim()
  const officeId = officeText ? matchOffice(officeText) : undefined
  if (officeText && !officeId) unmapped.push(`office "${officeText}"`)
  return {
    title,
    division,
    officeId,
    region: hub.region?.trim() || null,
    employmentType: normalizeEmploymentType(hub.employmentType),
    joinDate: parseJoinDate(hub.joinDate),
    unmapped,
  }
}
