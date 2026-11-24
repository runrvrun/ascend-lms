// Client for HUB's limited employee lookup (`GET /employees/limited?email=`, factory
// item HUB-6104), used by scripts/sync-m365-users.ts to fill in new users' details.
//
// Auth: client-credentials. POST /handoff/token with Basic auth (client "ycp-ascend")
// and `{ grant_type: "client_credentials" }` returns a short-lived (1 hour) bearer
// token. Nothing is stored: each run simply asks for a fresh one.
// Env: HUB_API_URL, HUB_CLIENT_ID, HUB_CLIENT_SECRET.

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

// A fresh access token, or the reason there isn't one (settings missing, HUB refused).
export async function getHubToken(): Promise<HubToken> {
  const clientId = process.env.HUB_CLIENT_ID
  const clientSecret = process.env.HUB_CLIENT_SECRET
  if (!process.env.HUB_API_URL || !clientId || !clientSecret) {
    return { token: null, reason: "HUB_API_URL / HUB_CLIENT_ID / HUB_CLIENT_SECRET not set" }
  }
  const res = await fetch(apiUrl("/handoff/token"), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  })
  if (!res.ok) return { token: null, reason: `HUB token request failed: ${res.status} ${await res.text()}` }
  const json: { access_token?: string } = await res.json()
  if (!json.access_token) return { token: null, reason: "HUB token response had no access_token" }
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
