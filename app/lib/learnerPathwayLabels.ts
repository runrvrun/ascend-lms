import type { LearnerPathway } from "./learnerPathways"

// Plain helpers shared by server pages and client components. Keep them out of
// "use client" files: a server component can't call a function exported from one.

export function enrollmentLabel(item: Pick<LearnerPathway, "cohortName" | "type" | "approverName">): string {
  if (item.cohortName) return `From cohort: ${item.cohortName}`
  if (item.type === "ASSIGNED") return item.approverName ? `Assigned by ${item.approverName}` : "Assigned"
  if (item.type === "USER_REQUEST") return "Self-requested"
  return "Self-enrolled"
}

export function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
