// Pure helpers (no prisma import) for combining a learner's results across a course's
// several assignments into the one status reports show per course.

export type AssignmentSubmissionStatus = "SUBMITTED" | "PASSED" | "FAILED"

// Per assignment: PASSED if any submission passed, otherwise the latest submission's status.
// `submissions` must be ordered oldest → newest.
export function statusByAssignment(
  submissions: { assignmentId: string; status: AssignmentSubmissionStatus | string }[],
): Map<string, AssignmentSubmissionStatus> {
  const out = new Map<string, AssignmentSubmissionStatus>()
  for (const s of submissions) {
    if (out.get(s.assignmentId) === "PASSED") continue
    out.set(s.assignmentId, s.status as AssignmentSubmissionStatus)
  }
  return out
}

// Combined over a course's assignments: PASSED once all are passed, FAILED if any unpassed one's
// latest submission failed, SUBMITTED if any is awaiting review, otherwise null (nothing submitted).
export function combinedAssignmentStatus(
  assignmentIds: string[],
  byAssignment: Map<string, AssignmentSubmissionStatus>,
): AssignmentSubmissionStatus | null {
  if (assignmentIds.length === 0) return null
  const statuses = assignmentIds.map((id) => byAssignment.get(id))
  if (statuses.every((s) => s === "PASSED")) return "PASSED"
  if (statuses.some((s) => s === "FAILED")) return "FAILED"
  if (statuses.some((s) => s === "SUBMITTED")) return "SUBMITTED"
  return null
}
