// Which of a pathway's courses count toward finishing it. Courses marked optional
// don't — unless every course is optional, in which case they all count (so a
// pathway can't be "complete" with nothing done). Pure: safe to import from
// scripts/, which can't use the app/lib/prisma.ts singleton.

export function requiredCourses<T extends { optional: boolean }>(courses: T[]): T[] {
  const required = courses.filter((c) => !c.optional)
  return required.length ? required : courses
}

export function requiredCourseIds<T extends { optional: boolean; courseId: string }>(courses: T[]): Set<string> {
  return new Set(requiredCourses(courses).map((c) => c.courseId))
}

// PathwayCourse rows for many pathways → each pathway's required course ids.
export function requiredCourseIdsByPathway(
  rows: { pathwayId: string; courseId: string; optional: boolean }[]
): Map<string, Set<string>> {
  const byPathway = new Map<string, { pathwayId: string; courseId: string; optional: boolean }[]>()
  for (const r of rows) byPathway.set(r.pathwayId, [...(byPathway.get(r.pathwayId) ?? []), r])
  return new Map([...byPathway].map(([pathwayId, list]) => [pathwayId, requiredCourseIds(list)]))
}
