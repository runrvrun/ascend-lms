export type OutlineItem = {
  kind: "CONTENT" | "TEST"
  id: string
  order: number
  label: string
}

export function buildCourseOutline(
  contents: { id: string; title: string; order: number | null }[],
  tests: { id: string; title: string; order: number }[]
): OutlineItem[] {
  return [
    ...contents.map((c) => ({ kind: "CONTENT" as const, id: c.id, order: c.order ?? 0, label: c.title })),
    ...tests.map((t) => ({ kind: "TEST" as const, id: t.id, order: t.order, label: t.title })),
  ].sort((a, b) => a.order - b.order)
}
