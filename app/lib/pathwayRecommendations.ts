// Automated "Recommended for you" picks for /pathways. Pure functions over data the
// page already loads; featured pathways are handled by the page and take priority.
//
// Three strategies, each with its own reason label:
// - popular: voluntary (self-enrolled / requested, not assigned or via cohort)
//   enrollments by others in the same division, so mandatory training doesn't dominate
// - next:    what people who completed one of your pathways voluntarily enrolled in afterwards
// - similar: shares tags or course topics with a pathway you're enrolled in or completed
//
// Each slot picks one of the strategies that still has candidates at random, so the
// mix of reasons varies between visits.

// Total "Recommended for you" carousel slots; featured pathways (at most
// MAX_FEATURED_PATHWAYS) take the first ones, automated picks fill the rest.
export const MAX_RECOMMENDATIONS = 4

// Pathways with any of these tags (case-insensitive) are never automated picks, nor the
// "after X" / "similar to X" reference: they are mostly mandatory, so they say little
// about what someone would choose. Admins can still feature them.
export const EXCLUDED_RECOMMENDATION_TAGS = ["onboarding"]

export function isExcludedFromRecommendations(tags: string[]) {
  return tags.some((t) => EXCLUDED_RECOMMENDATION_TAGS.includes(t.trim().toLowerCase()))
}

export type RecommendationKind = "featured" | "popular" | "next" | "similar"
export type Recommendation = { kind: RecommendationKind; label: string }

export type EnrollmentRow = {
  userId: string
  pathwayId: string
  createdAt: Date
  voluntary: boolean
  division: string | null
}

const MIN_POPULAR_ENROLLMENTS = 2

type Candidate = { pathwayId: string; score: number; label: string }

export function buildRecommendations({
  userId,
  userDivision,
  slots,
  eligibleIds,
  pathwayNames,
  pathwayFeatures,
  myEnrolledIds,
  myCompletedIds,
  completedPairs,
  enrollments,
}: {
  userId: string
  userDivision: string | null
  slots: number
  // Pathways the user could be recommended (not enrolled, not completed, not featured)
  eligibleIds: string[]
  pathwayNames: Record<string, string>
  // Lowercased tags and course topic ids per pathway
  pathwayFeatures: Record<string, Set<string>>
  myEnrolledIds: string[]
  myCompletedIds: string[]
  // "userId:pathwayId" for every completed pathway across all users
  completedPairs: Set<string>
  // Approved enrollments across all users
  enrollments: EnrollmentRow[]
}): { pathwayId: string; recommendation: Recommendation }[] {
  if (slots <= 0 || eligibleIds.length === 0) return []
  const eligible = new Set(eligibleIds)

  // ── Popular in your division ──────────────────────────────────────────────
  const popularCount: Record<string, number> = {}
  if (userDivision) {
    for (const e of enrollments) {
      if (e.voluntary && e.userId !== userId && e.division === userDivision && eligible.has(e.pathwayId)) {
        popularCount[e.pathwayId] = (popularCount[e.pathwayId] ?? 0) + 1
      }
    }
  }
  const popular: Candidate[] = Object.entries(popularCount)
    .filter(([, n]) => n >= MIN_POPULAR_ENROLLMENTS)
    .map(([pathwayId, score]) => ({ pathwayId, score, label: "Popular in your division" }))

  // ── Your next path after X ────────────────────────────────────────────────
  const next: Candidate[] = []
  if (myCompletedIds.length > 0) {
    const byUser: Record<string, EnrollmentRow[]> = {}
    for (const e of enrollments) {
      if (e.userId !== userId) (byUser[e.userId] ??= []).push(e)
    }
    // nextCount[Y][X] = people who completed X and then chose Y
    const nextCount: Record<string, Record<string, number>> = {}
    for (const rows of Object.values(byUser)) {
      for (const done of rows) {
        if (!myCompletedIds.includes(done.pathwayId) || !completedPairs.has(`${done.userId}:${done.pathwayId}`)) continue
        for (const after of rows) {
          if (after.voluntary && eligible.has(after.pathwayId) && after.createdAt > done.createdAt) {
            const counts = (nextCount[after.pathwayId] ??= {})
            counts[done.pathwayId] = (counts[done.pathwayId] ?? 0) + 1
          }
        }
      }
    }
    for (const [pathwayId, sources] of Object.entries(nextCount)) {
      const [sourceId, score] = Object.entries(sources).sort((a, b) => b[1] - a[1])[0]
      next.push({ pathwayId, score, label: `Your next path after ${pathwayNames[sourceId]}` })
    }
  }

  // ── Similar to X ──────────────────────────────────────────────────────────
  const similar: Candidate[] = []
  const sourceIds = [...new Set([...myEnrolledIds, ...myCompletedIds])]
  for (const pathwayId of eligibleIds) {
    const features = pathwayFeatures[pathwayId]
    if (!features?.size) continue
    let best: { sourceId: string; score: number } | null = null
    for (const sourceId of sourceIds) {
      const source = pathwayFeatures[sourceId]
      if (!source?.size) continue
      let shared = 0
      for (const f of features) if (source.has(f)) shared++
      if (shared === 0) continue
      const score = shared / (features.size + source.size - shared)
      if (!best || score > best.score) best = { sourceId, score }
    }
    if (best) similar.push({ pathwayId, score: best.score, label: `Similar to ${pathwayNames[best.sourceId]}` })
  }

  const pools: Record<Exclude<RecommendationKind, "featured">, Candidate[]> = {
    popular: popular.sort((a, b) => b.score - a.score),
    next: next.sort((a, b) => b.score - a.score),
    similar: similar.sort((a, b) => b.score - a.score),
  }

  const picked: { pathwayId: string; recommendation: Recommendation }[] = []
  const used = new Set<string>()
  while (picked.length < slots) {
    const available = (Object.keys(pools) as (keyof typeof pools)[]).filter((k) =>
      pools[k].some((c) => !used.has(c.pathwayId))
    )
    if (available.length === 0) break
    const kind = available[Math.floor(Math.random() * available.length)]
    const candidate = pools[kind].find((c) => !used.has(c.pathwayId))!
    used.add(candidate.pathwayId)
    picked.push({ pathwayId: candidate.pathwayId, recommendation: { kind, label: candidate.label } })
  }
  return picked
}
