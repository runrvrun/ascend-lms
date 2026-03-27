"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { ContentType, QuestionType } from "@prisma/client"

export type CourseFormData = {
  name: string
  description: string
  topicId: string | null
}

export type ContentFormData = {
  title: string
  type: ContentType
  value: string
  order: number
  duration: number | null // seconds, only relevant for VIDEO
}

export async function createCourse(data: CourseFormData): Promise<string> {
  const course = await prisma.course.create({
    data: { name: data.name, description: data.description || null, status: "DRAFT", topicId: data.topicId || null },
  })
  revalidatePath("/admin/course")
  revalidatePath("/sme/course")
  return course.id
}

export async function toggleCourseStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  await prisma.course.update({ where: { id }, data: { status } })
  revalidatePath("/admin/course")
}

export async function updateCourse(id: string, data: CourseFormData) {
  await prisma.course.update({
    where: { id },
    data: { name: data.name, description: data.description || null, topicId: data.topicId || null },
  })
  revalidatePath("/admin/course")
  revalidatePath(`/admin/course/${id}`)
  revalidatePath("/sme/course")
}

export async function deleteCourse(id: string) {
  await prisma.course.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/course")
}

export async function createContent(courseId: string, data: ContentFormData) {
  await prisma.content.create({
    data: { courseId, title: data.title, type: data.type, value: data.value, order: data.order, duration: data.duration },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateContent(id: string, courseId: string, data: ContentFormData) {
  await prisma.content.update({
    where: { id },
    data: { title: data.title, type: data.type, value: data.value, order: data.order, duration: data.duration },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteContent(id: string, courseId: string) {
  await prisma.content.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Test ──────────────────────────────────────────────────────────────────────

export async function createTest(courseId: string, passThreshold: number) {
  await prisma.test.create({ data: { courseId, passThreshold } })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateTest(testId: string, courseId: string, passThreshold: number) {
  await prisma.test.update({ where: { id: testId }, data: { passThreshold } })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteTest(testId: string, courseId: string) {
  await prisma.test.delete({ where: { id: testId } })
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Questions ─────────────────────────────────────────────────────────────────

export type OptionDraft = {
  text: string
  isCorrect?: boolean
  matchKey?: string
  order?: number
}

export type QuestionFormData = {
  type: QuestionType
  question: string
  order: number
  options: OptionDraft[]
}

export async function createQuestion(testId: string, courseId: string, data: QuestionFormData) {
  await prisma.question.create({
    data: {
      testId,
      type: data.type,
      question: data.question,
      order: data.order,
      options: { create: data.options },
    },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateQuestion(questionId: string, courseId: string, data: QuestionFormData) {
  await prisma.questionOption.deleteMany({ where: { questionId } })
  await prisma.question.update({
    where: { id: questionId },
    data: {
      type: data.type,
      question: data.question,
      order: data.order,
      options: { create: data.options },
    },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteQuestion(questionId: string, courseId: string) {
  await prisma.question.delete({ where: { id: questionId } })
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Trainers ──────────────────────────────────────────────────────────────────

export async function addCourseTrainer(courseId: string, userId: string) {
  await prisma.courseTrainer.create({ data: { courseId, userId } })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function removeCourseTrainer(courseId: string, userId: string) {
  await prisma.courseTrainer.deleteMany({ where: { courseId, userId } })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function setCourseTrainer(courseId: string, userId: string | null) {
  await prisma.courseTrainer.deleteMany({ where: { courseId } })
  if (userId) await prisma.courseTrainer.create({ data: { courseId, userId } })
  revalidatePath("/admin/course")
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Assignment ─────────────────────────────────────────────────────────────────

export type AssignmentFormData = {
  description: string
  submitUrl: string
}

export async function createAssignment(courseId: string, data: AssignmentFormData) {
  await prisma.assignment.create({
    data: { courseId, description: data.description, submitUrl: data.submitUrl },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateAssignment(assignmentId: string, courseId: string, data: AssignmentFormData) {
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { description: data.description, submitUrl: data.submitUrl },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteAssignment(assignmentId: string, courseId: string) {
  await prisma.assignment.update({ where: { id: assignmentId }, data: { deletedAt: new Date() } })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function gradeSubmission(
  submissionId: string,
  courseId: string,
  status: "PASSED" | "FAILED",
  adminNote: string | null
) {
  const session = await getServerSession(authOptions)
  const gradedById = (session?.user as any)?.id as string | undefined

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: { select: { id: true, name: true } },
      pathway: { select: { id: true, name: true } },
    },
  })
  if (!submission) throw new Error("Submission not found")

  await prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { status, adminNote, gradedAt: new Date(), gradedById: gradedById ?? null },
  })

  // Mirror assignment verdict into CourseProgress so sidebar can reflect it
  // If failed, also revert course completion
  await prisma.courseProgress.upsert({
    where: {
      userId_courseId_pathwayId: {
        userId: submission.userId,
        courseId,
        pathwayId: submission.pathwayId,
      },
    },
    create: { userId: submission.userId, courseId, pathwayId: submission.pathwayId, assignmentStatus: status },
    update: status === "FAILED"
      ? { assignmentStatus: "FAILED", completed: false, completedAt: null }
      : { assignmentStatus: "PASSED" },
  })

  // Notify user
  const courseName = await prisma.course.findUnique({ where: { id: courseId }, select: { name: true } })
  const message = status === "PASSED"
    ? `Your assignment for "${courseName?.name}" in "${submission.pathway.name}" has been marked as passed!`
    : `Your assignment for "${courseName?.name}" in "${submission.pathway.name}" has been marked as failed. Please resubmit.${adminNote ? ` Feedback: ${adminNote}` : ""}`

  await prisma.notification.create({
    data: {
      userId: submission.userId,
      type: "ASSIGNMENT_GRADED",
      message,
      pathwayId: submission.pathwayId,
    },
  })

  // If passed, check if all course contents and test (if any) are also done
  if (status === "PASSED") {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        contents: { where: { deletedAt: null }, select: { id: true } },
        test: { select: { id: true, deletedAt: true } },
      },
    })
    const allContentsCount = course?.contents.length ?? 0
    const completedCount = allContentsCount
      ? await prisma.contentProgress.count({
          where: {
            userId: submission.userId,
            pathwayId: submission.pathwayId,
            contentId: { in: course!.contents.map((c) => c.id) },
          },
        })
      : 0
    const allContentsComplete = !allContentsCount || completedCount === allContentsCount

    // Check if test also needs to be passed
    const activeTest = course?.test && course.test.deletedAt === null ? course.test : null
    const testPassed = activeTest
      ? !!(await prisma.courseProgress.findUnique({
          where: { userId_courseId_pathwayId: { userId: submission.userId, courseId, pathwayId: submission.pathwayId } },
          select: { testStatus: true },
        }).then((r) => r?.testStatus === "PASSED"))
      : true // no test required

    if (allContentsComplete && testPassed) {
      await prisma.courseProgress.upsert({
        where: {
          userId_courseId_pathwayId: {
            userId: submission.userId,
            courseId,
            pathwayId: submission.pathwayId,
          },
        },
        create: { userId: submission.userId, courseId, pathwayId: submission.pathwayId, completed: true, completedAt: new Date() },
        update: { completed: true, completedAt: new Date() }, // testScore/testStatus untouched
      })

      // Award points once
      const referenceId = `${courseId}:${submission.pathwayId}`
      const already = await prisma.userPoint.findFirst({
        where: { userId: submission.userId, source: "COURSE_COMPLETION", referenceId },
      })
      if (!already) {
        const pathwayCourse = await prisma.pathwayCourse.findUnique({
          where: { pathwayId_courseId: { pathwayId: submission.pathwayId, courseId } },
          select: { points: true },
        })
        if (pathwayCourse) {
          await prisma.userPoint.create({
            data: { userId: submission.userId, points: pathwayCourse.points, source: "COURSE_COMPLETION", referenceId },
          })
        }
      }
    }
  }

  revalidatePath(`/admin/course/${courseId}`)
  revalidatePath(`/pathways/${submission.pathwayId}`)
  revalidatePath("/notifications")
}

// ── Feedback ───────────────────────────────────────────────────────────────────

export async function toggleCourseFeedback(courseId: string, enabled: boolean) {
  await prisma.course.update({ where: { id: courseId }, data: { feedbackEnabled: enabled } })
  revalidatePath(`/admin/course/${courseId}`)
  revalidatePath(`/trainer/course/${courseId}`)
}
