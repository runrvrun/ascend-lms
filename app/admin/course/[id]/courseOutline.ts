export type OutlineItem = {
  kind: "CONTENT" | "TEST" | "ASSIGNMENT"
  id: string
  order: number
  label: string
}

// Content, tests and assignments share one `order` sequence per course; this merges them.
export function buildCourseOutline(
  contents: { id: string; title: string; order: number | null }[],
  tests: { id: string; title: string; order: number }[],
  assignments: { id: string; title: string; order: number | null }[] = []
): OutlineItem[] {
  return [
    ...contents.map((c) => ({ kind: "CONTENT" as const, id: c.id, order: c.order ?? 0, label: c.title })),
    ...tests.map((t) => ({ kind: "TEST" as const, id: t.id, order: t.order, label: t.title })),
    ...assignments.map((a) => ({ kind: "ASSIGNMENT" as const, id: a.id, order: a.order ?? 0, label: a.title })),
  ].sort((a, b) => a.order - b.order)
}
