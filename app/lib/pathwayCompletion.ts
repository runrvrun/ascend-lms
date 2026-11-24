// What counts toward finishing a pathway or a course.
//
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

// Which of a course's lessons count toward finishing it: the non-optional ones. If every
// lesson is optional and the course has no tests or assignments, they all count (so the
// course can't be finished with nothing done). `otherItems` = live tests + assignments.
export function requiredContents<T extends { optional: boolean }>(contents: T[], otherItems: number): T[] {
  const required = contents.filter((c) => !c.optional)
  return required.length || otherItems > 0 ? required : contents
}
