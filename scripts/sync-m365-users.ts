// Syncs Ascend `User` rows with the M365 (Entra ID) tenant directory. A user is active
// exactly when their directory account holds one of QUALIFYING_SKUS — the licenses
// that let them sign in with our SSO — whatever their email domain, and even if their
// sign-in is blocked (leavers stay active until their license is removed). So the sync:
//  - creates users for members holding a qualifying license who aren't in Ascend yet,
//    so staff can sign in via Azure AD without an admin registering them first;
//  - deactivates (soft-deletes via `deletedAt`) Ascend users whose directory account
//    no longer holds a qualifying license (how resignees are offboarded), or was
//    recently deleted from the directory. Their progress, points and enrollments are
//    kept, so they still count in reports and analytics.
//
// Never touched: Ascend users whose email isn't a directory member at all (external
// users, guests, dummy users on distribution-list addresses, or accounts deleted long
// ago) — those are listed for an admin to handle manually.
// Existing users only get their job title updated when M365 names a different
// recognised one (a blank or unrecognised M365 title leaves it alone); their other
// details are never updated, and deactivated users are never reactivated here — an
// admin reactivates them from Admin → Users (which restores the account with its
// history). Deactivated users who hold a qualifying license again are listed.
//
// If more than MAX_DEACTIVATIONS_RATIO of active users would be deactivated in one
// run, the deactivation step is skipped (pass --force to override) — that usually
// means a partial Graph response, not a mass departure.
//
// Requires an Application permission grant on the AZURE_AD_CLIENT_ID app
// registration: Microsoft Graph -> User.Read.All (Application), admin-consented.
//
//   npx tsx --env-file=.env scripts/sync-m365-users.ts [--dry-run] [--force]
//
// Intended to run on a schedule (cron) against the production DB. Safe to re-run.
import { PrismaClient, Division, JobTitle } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

const DRY_RUN = process.argv.includes("--dry-run")
const FORCE = process.argv.includes("--force")
const MAX_DEACTIVATIONS_RATIO = 0.1

// Licenses that let a user sign in with our SSO, i.e. that make them an active Ascend
// user. Free/add-on SKUs (Power Automate Free, Fabric Free, Power BI, Copilot, Visio, …)
// don't. SKU IDs are the same in every tenant; see
// https://learn.microsoft.com/entra/identity/users/licensing-service-plan-reference
const QUALIFYING_SKUS = new Set([
  "6fd2c87f-b296-42f0-b197-1e91e994b900", // ENTERPRISEPACK — Office 365 E3 (shown as "Non-Profit Pricing" in our tenant)
  "f245ecc8-75af-4f8e-b61f-27d8114de5f3", // O365_BUSINESS_PREMIUM — Microsoft 365 Business Standard
  "3b555118-da6a-4418-894f-7df1e2096870", // O365_BUSINESS_ESSENTIALS — Microsoft 365 Business Basic
  "cbdc14ab-d96c-4c30-b9f4-6ada7cdc1d46", // SPB — Microsoft 365 Business Premium
  "b05e124f-c7cc-45a0-a6aa-8cf78c946968", // EMSPREMIUM — Enterprise Mobility + Security E5
])

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
  assignedLicenses: { skuId: string }[] | null
  proxyAddresses: string[] | null
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

const SELECT_FIELDS =
  "id,displayName,mail,userPrincipalName,userType,accountEnabled,officeLocation,department,jobTitle,assignedLicenses,proxyAddresses"

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

// Every address a directory user can be known by in Ascend: mail, UPN, and SMTP aliases.
function graphUserEmails(u: GraphUser): string[] {
  const aliases = (u.proxyAddresses ?? [])
    .filter((p) => p.toLowerCase().startsWith("smtp:"))
    .map((p) => p.slice(5))
  return [u.mail, u.userPrincipalName, ...aliases].filter((e): e is string => !!e).map((e) => e.toLowerCase())
}

function hasQualifyingLicense(u: GraphUser) {
  return (u.assignedLicenses ?? []).some((l) => QUALIFYING_SKUS.has(l.skuId))
}

async function fetchPaged<T>(token: string, firstUrl: string): Promise<T[]> {
  let url: string | undefined = firstUrl
  const items: T[] = []
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      throw new Error(`Graph query failed (${firstUrl}): ${res.status} ${await res.text()}`)
    }
    const json: { value?: T[]; "@odata.nextLink"?: string } = await res.json()
    items.push(...(json.value ?? []))
    url = json["@odata.nextLink"]
  }
  return items
}

// Full listing rather than a delta query: deactivation needs the complete set of
// current members to know who has lost their license.
function fetchAllUsers(token: string) {
  return fetchPaged<GraphUser>(token, `https://graph.microsoft.com/v1.0/users?$select=${SELECT_FIELDS}&$top=999`)
}

// Users in the directory's recycle bin (kept ~30 days after deletion). A deleted
// user's UPN gets their object id prepended, so strip that to recover the address.
async function fetchDeletedUserEmails(token: string): Promise<Set<string>> {
  const deleted = await fetchPaged<GraphUser>(
    token,
    "https://graph.microsoft.com/v1.0/directory/deletedItems/microsoft.graph.user?$select=mail,userPrincipalName,proxyAddresses&$top=999"
  )
  return new Set(
    deleted.flatMap((u) =>
      graphUserEmails({ ...u, userPrincipalName: u.userPrincipalName?.replace(/^[0-9a-f]{32}/i, "") ?? null })
    )
  )
}

async function main() {
  const token = await getGraphToken()
  const users = await fetchAllUsers(token)

  const allOffices = await prisma.office.findMany({ select: { id: true, name: true } })
  const officeNameToId = new Map(allOffices.flatMap((o) => officeKeys(o.name).map((k) => [k, o.id] as const)))

  const deletedEmails = await fetchDeletedUserEmails(token)

  const members = users.filter((u) => u.userType === "Member")
  const memberByEmail = new Map(members.flatMap((u) => graphUserEmails(u).map((e) => [e, u] as const)))
  // Sign-in blocked doesn't matter: a licensed member is active.
  const toCreate = members.filter(hasQualifyingLicense)

  // Null = leave this Ascend user alone.
  function deactivationReason(email: string): string | null {
    const member = memberByEmail.get(email)
    if (member) return hasQualifyingLicense(member) ? null : "no M365 license"
    if (deletedEmails.has(email)) return "deleted from directory"
    return null
  }

  let created = 0
  let skippedExisting = 0
  let titlesUpdated = 0
  const licensedButDeactivated: string[] = []
  let skippedFiltered = 0

  for (const graphUser of toCreate) {
    const rawEmail = graphUser.mail ?? graphUser.userPrincipalName
    if (!rawEmail) {
      skippedFiltered++
      continue
    }
    const email = rawEmail.toLowerCase()

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, title: true, deletedAt: true },
    })
    if (existing) {
      skippedExisting++
      if (existing.deletedAt) licensedButDeactivated.push(email)
      const title = graphUser.jobTitle?.trim() ? mapJobTitle(graphUser.jobTitle) : undefined
      if (!existing.deletedAt && title && title !== existing.title) {
        console.log(`${DRY_RUN ? "[dry-run] would update" : "Updating"} title of ${email}: ${existing.title} → ${title} (M365: "${graphUser.jobTitle}")`)
        if (!DRY_RUN) await prisma.user.update({ where: { id: existing.id }, data: { title } })
        titlesUpdated++
      }
      continue
    }

    const officeId = graphUser.officeLocation ? officeNameToId.get(graphUser.officeLocation.trim().toLowerCase()) ?? null : null
    // Blank or unrecognised in M365 → NA, so an admin can spot and fix it.
    const division = mapDivision(graphUser.department) ?? Division.NA
    const title = mapJobTitle(graphUser.jobTitle) ?? JobTitle.NA

    if (DRY_RUN) {
      console.log(`[dry-run] would create ${email}`)
      created++
      continue
    }
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

  const ascendActive = await prisma.user.findMany({
    where: { deletedAt: null, email: { not: null } },
    select: { id: true, email: true, name: true },
  })
  const toDeactivate = ascendActive
    .map((u) => ({ ...u, reason: deactivationReason(u.email!.toLowerCase()) }))
    .filter((u): u is typeof u & { reason: string } => u.reason !== null)
  // Users with no directory account: external users, guests, distribution-list dummies
  // or accounts deleted long ago. Can't tell which, so an admin reviews them.
  const unmatched = ascendActive.filter((u) => {
    const email = u.email!.toLowerCase()
    return !memberByEmail.has(email) && !deletedEmails.has(email)
  })

  let deactivated = 0
  const limit = Math.max(5, Math.floor(ascendActive.length * MAX_DEACTIVATIONS_RATIO))
  if (toCreate.length === 0) {
    console.error("Graph returned no licensed members — skipping deactivation.")
  } else if (toDeactivate.length > limit && !FORCE) {
    console.error(
      `Refusing to deactivate ${toDeactivate.length} users (limit ${limit}) — check the Graph response, or re-run with --force.`
    )
    for (const u of toDeactivate) console.error(`  ${u.email} — ${u.reason}`)
  } else {
    for (const u of toDeactivate) {
      console.log(
        `${DRY_RUN ? "[dry-run] would deactivate" : "Deactivating"} ${u.email} (${u.name ?? "no name"}) — ${u.reason}`
      )
    }
    if (!DRY_RUN && toDeactivate.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: toDeactivate.map((u) => u.id) }, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      deactivated = result.count
    } else {
      deactivated = toDeactivate.length
    }
  }

  if (licensedButDeactivated.length > 0) {
    console.log(`${licensedButDeactivated.length} deactivated users hold a qualifying license (reactivate from Admin → Users if they should be back):`)
    for (const email of licensedButDeactivated) console.log(`  ${email}`)
  }

  if (unmatched.length > 0) {
    console.log(`${unmatched.length} active users have no directory account (left for manual review):`)
    for (const u of unmatched) console.log(`  ${u.email} (${u.name ?? "no name"})`)
  }

  console.log(
    `M365 sync ${DRY_RUN ? "dry run " : ""}complete: ${users.length} seen, ${toCreate.length} licensed members, ` +
      `${created} created, ${skippedExisting} already existed (${titlesUpdated} title updates), ${skippedFiltered} filtered out, ${deactivated} deactivated, ` +
      `${unmatched.length} unmatched, ${licensedButDeactivated.length} licensed but deactivated.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
