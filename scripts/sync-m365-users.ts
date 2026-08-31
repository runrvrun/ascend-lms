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
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import path from "path"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const STATE_FILE = path.join(__dirname, ".m365-sync-state.json")

type SyncState = { deltaLink?: string; lastRunAt?: string }

type GraphUser = {
  id: string
  displayName: string | null
  mail: string | null
  userPrincipalName: string | null
  userType: string | null
  accountEnabled: boolean | null
  officeLocation: string | null
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

const SELECT_FIELDS = "id,displayName,mail,userPrincipalName,userType,accountEnabled,officeLocation"

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
  const { users, deltaLink } = await fetchDeltaUsers(token, state.deltaLink)

  const allOffices = await prisma.office.findMany({ select: { id: true, name: true } })
  const officeNameToId = new Map(allOffices.map((o) => [o.name.toLowerCase(), o.id]))

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

    const officeId = graphUser.officeLocation ? officeNameToId.get(graphUser.officeLocation.toLowerCase()) ?? null : null

    try {
      await prisma.user.create({
        data: {
          name: graphUser.displayName,
          email,
          officeId,
        },
      })
      created++
    } catch (error) {
      console.error(`Failed to create user for ${email}:`, error)
    }
  }

  writeState({ deltaLink, lastRunAt: new Date().toISOString() })

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
