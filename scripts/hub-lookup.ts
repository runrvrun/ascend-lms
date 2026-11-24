// Looks up one employee in HUB and prints what the M365 sync would get for them —
// to check the HUB connection (app/lib/hubEmployees.ts) by hand.
//
//   npx tsx --env-file=.env scripts/hub-lookup.ts <email>
import { fetchHubEmployee, getHubToken } from "../app/lib/hubEmployees"

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"))
  if (!email) throw new Error("Usage: hub-lookup.ts <email>")

  const result = await getHubToken()
  if (result.token === null) throw new Error(result.reason)

  const employee = await fetchHubEmployee(result.token, email)
  console.log(employee ? JSON.stringify(employee, null, 2) : `${email} is not in HUB.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
