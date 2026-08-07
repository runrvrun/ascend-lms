"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { evaluateCourseCompletion } from "../../lib/courseCompletion"
import { ContentType, QuestionType, Prisma } from "@prisma/client"

export type CourseFormData = {
  name: string
  description: string
  topicId: string | null
}

export type ContentFormData = {
  title: string
  type: ContentType
  value: string
  duration: number | null // seconds, only relevant for VIDEO
  insertAfterOrder: number // 0 = insert at the very beginning
}

export type ContentEditData = {
  title: string
  type: ContentType
  value: string
  duration: number | null
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

export async function duplicateCourse(id: string): Promise<string> {
  const source = await prisma.course.findUnique({
    where: { id },
    include: {
      trainers: { select: { userId: true } },
      contents: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      tests: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          questions: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            include: { options: true },
          },
        },
      },
      assignment: true,
    },
  })
  if (!source) throw new Error("Course not found")

  // Find a unique name: "{name}-copy", then "{name}-copy 2", etc.
  const baseName = `${source.name}-copy`
  let newName = baseName
  let suffix = 2
  while (await prisma.course.findFirst({ where: { name: newName, deletedAt: null } })) {
    newName = `${baseName} ${suffix++}`
  }

  const newCourse = await prisma.course.create({
    data: {
      name: newName,
      description: source.description,
      status: "DRAFT",
      topicId: source.topicId,
      feedbackEnabled: source.feedbackEnabled,
    },
  })

  if (source.trainers.length > 0) {
    await prisma.courseTrainer.createMany({
      data: source.trainers.map((t) => ({ courseId: newCourse.id, userId: t.userId })),
    })
  }

  if (source.contents.length > 0) {
    await prisma.content.createMany({
      data: source.contents.map((c) => ({
        courseId: newCourse.id,
        title: c.title,
        type: c.type,
        value: c.value,
        order: c.order,
        duration: c.duration,
      })),
    })
  }

  for (const test of source.tests) {
    const newTest = await prisma.test.create({
      data: { courseId: newCourse.id, title: test.title, order: test.order, passThreshold: test.passThreshold },
    })
    for (const q of test.questions) {
      await prisma.question.create({
        data: {
          testId: newTest.id,
          type: q.type,
          question: q.question,
          order: q.order,
          options: {
            create: q.options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              matchKey: o.matchKey,
              order: o.order,
            })),
          },
        },
      })
    }
  }

  if (source.assignment && !source.assignment.deletedAt) {
    await prisma.assignment.create({
      data: {
        courseId: newCourse.id,
        description: source.assignment.description,
        submitUrl: source.assignment.submitUrl,
      },
    })
  }

  revalidatePath("/admin/course")
  revalidatePath("/sme/course")
  return newCourse.id
}

const touchCourse = (courseId: string) =>
  prisma.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })

// ── Shared course-item ordering ────────────────────────────────────────────────
// Content and Test share one order sequence per course so they can be freely
// interleaved. Both tables enforce their own @@unique([courseId, order]), so
// shifting is done per-table (never cross-table collisions), but the two shifts
// are always issued together so the merged sequence stays contiguous.

async function shiftCourseItemsUpFrom(tx: Prisma.TransactionClient, courseId: string, fromOrderInclusive: number) {
  const [contents, tests] = await Promise.all([
    tx.content.findMany({
      where: { courseId, deletedAt: null, order: { gte: fromOrderInclusive } },
      orderBy: { order: "desc" },
      select: { id: true, order: true },
    }),
    tx.test.findMany({
      where: { courseId, deletedAt: null, order: { gte: fromOrderInclusive } },
      orderBy: { order: "desc" },
      select: { id: true, order: true },
    }),
  ])
  for (const c of contents) await tx.content.update({ where: { id: c.id }, data: { order: c.order! + 1 } })
  for (const t of tests) await tx.test.update({ where: { id: t.id }, data: { order: t.order + 1 } })
}

async function shiftCourseItemsDownAfter(tx: Prisma.TransactionClient, courseId: string, removedOrder: number) {
  const [contents, tests] = await Promise.all([
    tx.content.findMany({
      where: { courseId, deletedAt: null, order: { gt: removedOrder } },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    }),
    tx.test.findMany({
      where: { courseId, deletedAt: null, order: { gt: removedOrder } },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    }),
  ])
  for (const c of contents) await tx.content.update({ where: { id: c.id }, data: { order: c.order! - 1 } })
  for (const t of tests) await tx.test.update({ where: { id: t.id }, data: { order: t.order - 1 } })
}

export type CourseItemKind = "CONTENT" | "TEST"

export async function swapCourseItemOrder(
  item1: { kind: CourseItemKind; id: string; order: number },
  item2: { kind: CourseItemKind; id: string; order: number },
  courseId: string,
) {
  await prisma.$transaction(async (tx) => {
    const setOrder = (kind: CourseItemKind, id: string, order: number) =>
      kind === "CONTENT" ? tx.content.update({ where: { id }, data: { order } }) : tx.test.update({ where: { id }, data: { order } })

    if (item1.kind === item2.kind) {
      // Same table — go through a temporary value to dodge the unique constraint mid-swap
      await setOrder(item1.kind, item1.id, -1)
      await setOrder(item2.kind, item2.id, item1.order)
      await setOrder(item1.kind, item1.id, item2.order)
    } else {
      await setOrder(item1.kind, item1.id, item2.order)
      await setOrder(item2.kind, item2.id, item1.order)
    }
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Content ───────────────────────────────────────────────────────────────────

export async function createContent(courseId: string, data: ContentFormData) {
  await prisma.$transaction(async (tx) => {
    const target = data.insertAfterOrder + 1
    await shiftCourseItemsUpFrom(tx, courseId, target)
    await tx.content.create({
      data: { courseId, title: data.title, type: data.type, value: data.value, order: target, duration: data.duration },
    })
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateContent(id: string, courseId: string, data: ContentEditData) {
  await Promise.all([
    prisma.content.update({
      where: { id },
      data: { title: data.title, type: data.type, value: data.value, duration: data.duration },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteContent(id: string, courseId: string) {
  await prisma.$transaction(async (tx) => {
    const content = await tx.content.findUnique({ where: { id }, select: { order: true } })
    if (!content || content.order === null) return

    await tx.content.update({ where: { id }, data: { deletedAt: new Date(), order: null } })
    await shiftCourseItemsDownAfter(tx, courseId, content.order)
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Test ──────────────────────────────────────────────────────────────────────

export type TestFormData = {
  title: string
  passThreshold: number
}

export async function createTest(courseId: string, data: TestFormData & { insertAfterOrder: number }) {
  await prisma.$transaction(async (tx) => {
    const target = data.insertAfterOrder + 1
    await shiftCourseItemsUpFrom(tx, courseId, target)
    await tx.test.create({
      data: { courseId, title: data.title, passThreshold: data.passThreshold, order: target },
    })
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateTest(testId: string, courseId: string, data: TestFormData) {
  await Promise.all([
    prisma.test.update({ where: { id: testId }, data: { title: data.title, passThreshold: data.passThreshold } }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteTest(testId: string, courseId: string) {
  await prisma.$transaction(async (tx) => {
    const test = await tx.test.findUnique({ where: { id: testId }, select: { order: true } })
    if (!test) return

    await tx.test.update({ where: { id: testId }, data: { deletedAt: new Date() } })
    await shiftCourseItemsDownAfter(tx, courseId, test.order)
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
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
  await Promise.all([
    prisma.question.create({
      data: {
        testId,
        type: data.type,
        question: data.question,
        order: data.order,
        options: { create: data.options },
      },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateQuestion(questionId: string, courseId: string, data: QuestionFormData) {
  await prisma.questionOption.deleteMany({ where: { questionId } })
  await Promise.all([
    prisma.question.update({
      where: { id: questionId },
      data: {
        type: data.type,
        question: data.question,
        order: data.order,
        options: { create: data.options },
      },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteQuestion(questionId: string, courseId: string) {
  await Promise.all([
    prisma.question.delete({ where: { id: questionId } }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Pop Quizzes ───────────────────────────────────────────────────────────────

export type PopQuizOptionDraft = {
  text: string
  isCorrect: boolean
}

export type PopQuizFormData = {
  contentId: string
  time: number // seconds into the video
  question: string
  options: PopQuizOptionDraft[]
}

async function assertYoutubeContent(contentId: string) {
  const content = await prisma.content.findUnique({ where: { id: contentId }, select: { type: true } })
  if (!content || content.type !== "YOUTUBE_VIDEO") {
    throw new Error("Pop quizzes can only be added to YouTube Video content.")
  }
}

export async function createPopQuiz(courseId: string, data: PopQuizFormData) {
  await assertYoutubeContent(data.contentId)
  await Promise.all([
    prisma.popQuiz.create({
      data: {
        contentId: data.contentId,
        time: data.time,
        question: data.question,
        options: {
          create: data.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i })),
        },
      },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
  revalidatePath(`/trainer/course/${courseId}`)
  revalidatePath(`/sme/course/${courseId}`)
}

export async function updatePopQuiz(popQuizId: string, courseId: string, data: PopQuizFormData) {
  await assertYoutubeContent(data.contentId)
  await prisma.popQuizOption.deleteMany({ where: { popQuizId } })
  await Promise.all([
    prisma.popQuiz.update({
      where: { id: popQuizId },
      data: {
        contentId: data.contentId,
        time: data.time,
        question: data.question,
        options: {
          create: data.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i })),
        },
      },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
  revalidatePath(`/trainer/course/${courseId}`)
  revalidatePath(`/sme/course/${courseId}`)
}

export async function deletePopQuiz(popQuizId: string, courseId: string) {
  await Promise.all([
    prisma.popQuiz.delete({ where: { id: popQuizId } }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
  revalidatePath(`/trainer/course/${courseId}`)
  revalidatePath(`/sme/course/${courseId}`)
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

export async function setCourseTrainers(courseId: string, userIds: string[]) {
  await prisma.courseTrainer.deleteMany({ where: { courseId } })
  if (userIds.length > 0) {
    await prisma.courseTrainer.createMany({ data: userIds.map((userId) => ({ courseId, userId })) })
  }
  revalidatePath("/admin/course")
  revalidatePath(`/admin/course/${courseId}`)
}

// ── Assignment ─────────────────────────────────────────────────────────────────

export type AssignmentFormData = {
  description: string
  submitUrl: string
}

export async function createAssignment(courseId: string, data: AssignmentFormData) {
  await Promise.all([
    prisma.assignment.create({
      data: { courseId, description: data.description, submitUrl: data.submitUrl },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateAssignment(assignmentId: string, courseId: string, data: AssignmentFormData) {
  await Promise.all([
    prisma.assignment.update({
      where: { id: assignmentId },
      data: { description: data.description, submitUrl: data.submitUrl },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteAssignment(assignmentId: string, courseId: string) {
  await Promise.all([
    prisma.assignment.update({ where: { id: assignmentId }, data: { deletedAt: new Date() } }),
    touchCourse(courseId),
  ])
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

  // If passed, check if all other course requirements (contents, tests) are also done
  if (status === "PASSED") {
    await evaluateCourseCompletion(submission.userId, courseId, submission.pathwayId)
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
