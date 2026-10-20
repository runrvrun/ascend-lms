// Pulls newly-added users from the M365 (Entra ID) tenant directory and creates
// matching Ascend `User` rows, so staff can sign in via Azure AD without an admin
// having to register them first. Never updates or removes existing users — a
// user removed from M365 is left untouched here (Ascend keeps its own history).
//
// Requires an Application permission grant on the AZURE_AD_CLIENT_ID app
// registration: Microsoft Graph -> User.Read.All (Application), admin-consented.
//
//   npx tsx --env-file=.env scripts/sync-m365-users.ts
//
// Intended to run on a schedule (cron) against the production DB. Safe to
// re-run: already-synced and manually-created users are looked up by email
// and skipped rather than recreated.
import { PrismaClient, Division, JobTitle } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import path from "path"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const STATE_FILE = path.join(__dirname, ".m365-sync-state.json")

// `select` records which fields the saved deltaLink was built with — a deltaLink
// keeps its original $select, so changing SELECT_FIELDS must restart the delta.
type SyncState = { deltaLink?: string; select?: string; lastRunAt?: string }

type GraphUser = {
  id: string
  displayName: string | null
  mail: string | null
  userPrincipalName: string | null
  userType: string | null
  accountEnabled: boolean | null
  officeLocation: string | null
  department: string | null
  jobTitle: string | null
  "@removed"?: { reason: string }
}

function readState(): SyncState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
  } catch {
    return {}
  }
}

function writeState(state: SyncState) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET")
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to acquire Graph token: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  return json.access_token
}

const SELECT_FIELDS = "id,displayName,mail,userPrincipalName,userType,accountEnabled,officeLocation,department,jobTitle"

// M365 `department` values that don't match a Division name as-is.
const DEPARTMENT_ALIASES: Record<string, Division> = {
  "TCD/TALENT MANAGEMENT": Division.TCD,
  "TCD/TM": Division.TCD,
  FINANCE: Division.FIN,
}

const VALID_TITLES = new Set<string>(Object.values(JobTitle))

function mapDivision(department: string | null): Division | undefined {
  const key = department?.trim().toUpperCase()
  if (!key) return Division.NA
  if (DEPARTMENT_ALIASES[key]) return DEPARTMENT_ALIASES[key]
  // Enum values aren't all uppercase (e.g. `Contractor`), so match case-insensitively.
  return Object.values(Division).find((d) => d.toUpperCase() === key)
}

// M365 titles are either a plain title ("Team Lead") or a comma-separated list
// like "Group Officer, Managing Partner, Japan Regional CEO" — take the first
// part that names a JobTitle.
function mapJobTitle(jobTitle: string | null): JobTitle | undefined {
  if (!jobTitle?.trim()) return JobTitle.NA
  for (const part of jobTitle.split(",")) {
    const key = part.trim().toUpperCase().replace(/\s+/g, "_")
    if (VALID_TITLES.has(key)) return key as JobTitle
  }
  return undefined
}

// Ascend office names carry a region prefix ("SEA - YCP Singapore") that M365's
// officeLocation ("YCP Singapore") doesn't, so index each office under both.
function officeKeys(name: string): string[] {
  const full = name.trim().toLowerCase()
  const unprefixed = full.replace(/^[a-z]+ - /, "")
  return unprefixed === full ? [full] : [full, unprefixed]
}

async function fetchDeltaUsers(token: string, deltaLink?: string): Promise<{ users: GraphUser[]; deltaLink: string }> {
  let url = deltaLink ?? `https://graph.microsoft.com/v1.0/users/delta?$select=${SELECT_FIELDS}`
  const users: GraphUser[] = []

  while (true) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      throw new Error(`Graph delta query failed: ${res.status} ${await res.text()}`)
    }
    const json = await res.json()
    users.push(...(json.value ?? []))

    if (json["@odata.nextLink"]) {
      url = json["@odata.nextLink"]
      continue
    }
    return { users, deltaLink: json["@odata.deltaLink"] }
  }
}

async function main() {
  const state = readState()
  const token = await getGraphToken()
  const resumable = state.select === SELECT_FIELDS ? state.deltaLink : undefined
  const { users, deltaLink } = await fetchDeltaUsers(token, resumable)

  const allOffices = await prisma.office.findMany({ select: { id: true, name: true } })
  const officeNameToId = new Map(allOffices.flatMap((o) => officeKeys(o.name).map((k) => [k, o.id] as const)))

  let created = 0
  let skippedExisting = 0
  let skippedFiltered = 0

  for (const graphUser of users) {
    if (graphUser["@removed"]) continue

    if (graphUser.userType !== "Member" || graphUser.accountEnabled === false) {
      skippedFiltered++
      continue
    }

    const rawEmail = graphUser.mail ?? graphUser.userPrincipalName
    if (!rawEmail) {
      skippedFiltered++
      continue
    }
    const email = rawEmail.toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      skippedExisting++
      continue
    }

    const officeId = graphUser.officeLocation ? officeNameToId.get(graphUser.officeLocation.trim().toLowerCase()) ?? null : null
    // Blank in M365 → NA; set but unrecognised → schema defaults (MSD / ANALYST).
    const division = mapDivision(graphUser.department)
    const title = mapJobTitle(graphUser.jobTitle)

    try {
      await prisma.user.create({
        data: {
          name: graphUser.displayName,
          email,
          officeId,
          division,
          title,
        },
      })
      created++
    } catch (error) {
      console.error(`Failed to create user for ${email}:`, error)
    }
  }

  writeState({ deltaLink, select: SELECT_FIELDS, lastRunAt: new Date().toISOString() })

  console.log(
    `M365 sync complete: ${users.length} seen, ${created} created, ${skippedExisting} already existed, ${skippedFiltered} filtered out.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
