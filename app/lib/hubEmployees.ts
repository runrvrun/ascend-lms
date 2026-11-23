// Client for HUB's limited employee lookup (`GET /employees/limited?email=`, factory
// item HUB-6104), used by scripts/sync-m365-users.ts to fill in new users' details.
// Takes the PrismaClient as a parameter: scripts build their own client and can't
// import the app/lib/prisma.ts singleton.
//
// Auth: HUB issues Ascend (client "ycp-ascend") a handoff code, which is SINGLE-USE —
// exchanging it at POST /handoff/token returns an access token with no refresh token.
// The token is stored in the IntegrationToken table and reused until it expires; once
// it has, a new handoff code must be put in HUB_HANDOFF_CODE (see the note in .env).
// Env: HUB_API_URL, HUB_CLIENT_ID, HUB_CLIENT_SECRET, HUB_HANDOFF_CODE, and optionally
// HUB_ACCESS_TOKEN to use a token directly (e.g. on a second server) without exchanging.
import { createHash } from "node:crypto"
import type { PrismaClient } from "@prisma/client"

const PROVIDER = "hub"
// Treat a token this close to expiry as expired, so it can't lapse mid-run.
const EXPIRY_MARGIN_MS = 10 * 60 * 1000

export type HubEmployee = {
  id: string | null
  name: string | null
  join_date: string | null // yyyy-MM-dd
  status: { id: string; value: string } | null
  division: string | null
  employment_type: { id: string; value: string } | null
  job_title: { id: number | string; value: string } | null
  office: { id: number | string; value: string } | null
  region: string | null
  hr_code: string | null
}

export type HubToken = { token: string } | { token: null; reason: string }

function apiUrl(path: string) {
  const base = process.env.HUB_API_URL?.replace(/\/+$/, "")
  if (!base) throw new Error("HUB_API_URL is not set")
  return `${base}${path}`
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

// Returns a usable access token, exchanging HUB_HANDOFF_CODE for one only when
// `allowExchange` is set (never in a dry run — the exchange uses the code up).
export async function getHubToken(prisma: PrismaClient, { allowExchange }: { allowExchange: boolean }): Promise<HubToken> {
  if (process.env.HUB_ACCESS_TOKEN) return { token: process.env.HUB_ACCESS_TOKEN }
  if (!process.env.HUB_API_URL) return { token: null, reason: "HUB_API_URL is not set" }

  const stored = await prisma.integrationToken.findUnique({ where: { provider: PROVIDER } })
  if (stored && stored.expiresAt.getTime() > Date.now() + EXPIRY_MARGIN_MS) return { token: stored.accessToken }

  const code = process.env.HUB_HANDOFF_CODE?.trim()
  const clientId = process.env.HUB_CLIENT_ID
  const clientSecret = process.env.HUB_CLIENT_SECRET
  if (!code || !clientId || !clientSecret) {
    return { token: null, reason: "HUB_HANDOFF_CODE / HUB_CLIENT_ID / HUB_CLIENT_SECRET not set" }
  }
  const codeHash = sha256(code)
  if (stored?.codeHash === codeHash) {
    return {
      token: null,
      reason: `HUB token expired on ${stored.expiresAt.toISOString()} and its handoff code is used up — get a new code from the HUB team and put it in HUB_HANDOFF_CODE`,
    }
  }
  if (!allowExchange) return { token: null, reason: "no stored HUB token; a real (non-dry) run would exchange HUB_HANDOFF_CODE for one" }

  const res = await fetch(apiUrl("/handoff/token"), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    return { token: null, reason: `HUB handoff exchange failed: ${res.status} ${await res.text()}` }
  }
  const json: { access_token: string; expires_in: number } = await res.json()
  const expiresAt = new Date(Date.now() + json.expires_in * 1000)
  // Save straight away: the code is now spent, so losing the token would lock us out.
  await prisma.integrationToken.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, accessToken: json.access_token, expiresAt, codeHash },
    update: { accessToken: json.access_token, expiresAt, codeHash },
  })
  console.log(`Exchanged the HUB handoff code for an access token valid until ${expiresAt.toISOString()}.`)
  return { token: json.access_token }
}

export class HubAuthError extends Error {}

// The employee with this email, or null when HUB has none. Throws HubAuthError when
// the token is rejected, so the caller can stop looking up the rest.
export async function fetchHubEmployee(token: string, email: string): Promise<HubEmployee | null> {
  const res = await fetch(apiUrl(`/employees/limited?email=${encodeURIComponent(email)}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (res.status === 401 || res.status === 403) {
    throw new HubAuthError(`HUB rejected the access token (${res.status}): ${await res.text()}`)
  }
  if (!res.ok) throw new Error(`HUB employee lookup failed for ${email}: ${res.status} ${await res.text()}`)
  return res.json()
}
