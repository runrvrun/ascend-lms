"use client"

import { ContentType } from "@prisma/client"
import { ContentViewer } from "../PathwayViewer"

const EMPTY_SET = new Set<string>()

export function SampleContent({
  pathwayId,
  courseId,
  currentUserId,
  content,
}: {
  pathwayId: string
  courseId: string
  currentUserId: string
  content: { id: string; title: string; type: ContentType; value: string; order: number | null; duration: number | null }
}) {
  return (
    <ContentViewer
      // Pop quizzes are left out of the sample.
      selection={{ kind: "content", content: { ...content, popQuizzes: [] }, courseId }}
      pathwayId={pathwayId}
      completedContentIds={EMPTY_SET}
      completedCourseIds={EMPTY_SET}
      currentUserId={currentUserId}
      latestSubmissionByAssignmentId={{}}
      testStatusByTestId={{}}
      assignmentStatusByCourseId={{}}
      feedbackByCourseId={{}}
      sample
    />
  )
}
