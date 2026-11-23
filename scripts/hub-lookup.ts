// Looks up one employee in HUB and prints what the M365 sync would get for them —
// to check the HUB connection (app/lib/hubEmployees.ts) by hand.
//
//   npx tsx --env-file=.env scripts/hub-lookup.ts <email> [--exchange]
//
// Uses the stored (or HUB_ACCESS_TOKEN) token. Without one, pass --exchange to swap
// HUB_HANDOFF_CODE for a token and store it — that uses the single-use code up, so do
// it on the server whose sync cron will use the token (production).
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { fetchHubEmployee, getHubToken } from "../app/lib/hubEmployees"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"))
  if (!email) throw new Error("Usage: hub-lookup.ts <email> [--exchange]")

  const result = await getHubToken(prisma, { allowExchange: process.argv.includes("--exchange") })
  if (result.token === null) throw new Error(result.reason)

  const employee = await fetchHubEmployee(result.token, email)
  console.log(employee ? JSON.stringify(employee, null, 2) : `${email} is not in HUB.`)

  const stored = await prisma.integrationToken.findUnique({ where: { provider: "hub" } })
  if (stored) console.log(`Stored HUB token expires ${stored.expiresAt.toISOString()}.`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
