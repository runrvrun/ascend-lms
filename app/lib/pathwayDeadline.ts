// Rules derived from PathwayEnrollment.deadline. Pure functions only — shared by
// server actions, pages, and the cron scripts (which can't import the prisma singleton).
//
// A deadline is a calendar date stored as UTC midnight (e.g. "2026-10-15" →
// 2026-10-15T00:00Z), and every day boundary below is a UTC day, so the cron
// scripts and the app agree regardless of the server's timezone.
//
//   - reminder emails go out on the day before the deadline and on the deadline day
//   - the weekly digest stops once the deadline day is over
//   - DEADLINE_GRACE_DAYS after the deadline day, the enrollment locks: content
//     stays viewable but nothing can be completed or submitted

export const DEADLINE_GRACE_DAYS = 7
const DAY_MS = 86_400_000

export function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * DAY_MS)
}

// "YYYY-MM-DD" from an <input type="date"> → UTC-midnight Date; empty → null.
export function parseDeadlineInput(value: string | null | undefined): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid deadline date")
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new Error("Invalid deadline date")
  return d
}

export function toDeadlineInput(deadline: Date | string | null): string {
  return deadline ? new Date(deadline).toISOString().slice(0, 10) : ""
}

// True once the whole deadline day has passed.
export function isDeadlinePassed(deadline: Date | null, now = new Date()) {
  return !!deadline && startOfUtcDay(deadline).getTime() < startOfUtcDay(now).getTime()
}

// First moment learners can no longer make progress: the start of the day after
// the last grace day.
export function deadlineLockAt(deadline: Date) {
  return addDays(startOfUtcDay(deadline), DEADLINE_GRACE_DAYS + 1)
}

export function isDeadlineLocked(deadline: Date | null, now = new Date()) {
  return !!deadline && now.getTime() >= deadlineLockAt(deadline).getTime()
}
