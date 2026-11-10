import { prisma } from "../../../lib/prisma"
import { CourseTabLayout } from "./CourseTabLayout"
import { CourseItems } from "./CourseItems"
import { SubmissionsPanel } from "./AssignmentModals"
import { FeedbackSection } from "./FeedbackSection"
import { buildCourseOutline } from "./courseOutline"

// The Contents / Assignment Submissions / Feedbacks tabs of the course editor, shared by
// the admin, SME and trainer course pages. Loads its own data.
export async function CourseEditorTabs({ courseId, feedbackEnabled }: { courseId: string; feedbackEnabled: boolean }) {
  const [contents, tests, assignments, feedbacks] = await Promise.all([
    prisma.content.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        popQuizzes: {
          where: { deletedAt: null },
          orderBy: { time: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.test.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.assignment.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            pathway: { select: { id: true, name: true } },
            gradedBy: { select: { name: true } },
          },
        },
      },
    }),
    prisma.courseFeedback.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ])

  // Live rows always have an order (it's only nulled on soft-delete).
  const liveContents = contents.map((c) => ({ ...c, order: c.order! }))
  const liveTests = tests.map((t) => ({ ...t, order: t.order! }))
  const liveAssignments = assignments.map((a) => ({ ...a, order: a.order! }))
  const outline = buildCourseOutline(liveContents, liveTests, liveAssignments)

  return (
    <CourseTabLayout
      content={
        <CourseItems
          courseId={courseId}
          contents={liveContents}
          tests={liveTests}
          assignments={liveAssignments.map((a) => ({ id: a.id, title: a.title, order: a.order, description: a.description, submitUrl: a.submitUrl }))}
          outline={outline}
        />
      }
      submissions={<SubmissionsPanel courseId={courseId} assignments={liveAssignments} />}
      feedback={<FeedbackSection courseId={courseId} feedbackEnabled={feedbackEnabled} feedbacks={feedbacks} />}
    />
  )
}
