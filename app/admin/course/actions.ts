"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { evaluateCourseCompletion } from "../../lib/courseCompletion"
import { canEditCourse, getSessionUser } from "../../lib/permissions"
import { deleteContentImage, isContentImageKey, saveContentImage } from "../../lib/contentImages"
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
  imageKey: string | null // required for IMAGE, optional for LINK
  insertAfterOrder: number // 0 = insert at the very beginning
}

export type ContentEditData = {
  title: string
  type: ContentType
  value: string
  duration: number | null
  imageKey: string | null
}

// Only IMAGE and LINK content carry an image; drop a stale key if the type changed.
function contentImageKey(data: { type: ContentType; imageKey: string | null }) {
  if (data.type !== "IMAGE" && data.type !== "LINK") return null
  if (data.imageKey && !isContentImageKey(data.imageKey)) throw new Error("Invalid image.")
  if (data.type === "IMAGE" && !data.imageKey) throw new Error("Upload an image first.")
  return data.imageKey
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
        imageKey: c.imageKey, // image files are never deleted, so the copy can share them
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

async function assertAdmin() {
  const session = await getServerSession(authOptions)
  const roles = ((session?.user as any)?.roles as string[]) ?? []
  if (!session?.user || !roles.includes("ADMIN")) {
    throw new Error("Only admins can do this.")
  }
}

// Shape written by the "Export" action below. Kept loose (not the Prisma
// types) since this is untrusted, hand-editable JSON coming back in.
type CourseExport = {
  course: {
    name: string
    description: string | null
    status?: "DRAFT" | "PUBLISHED"
    feedbackEnabled?: boolean
    topicName?: string | null
  }
  contents?: {
    title: string
    type: ContentType
    value: string
    duration: number | null
    order: number | null
    // Base64 image embedded by the export route so it survives a move between servers
    image?: { data: string } | null
    popQuizzes?: {
      time: number
      question: string
      options: { text: string; isCorrect: boolean; order: number }[]
    }[]
  }[]
  tests?: {
    title: string
    order: number | null
    passThreshold: number
    questions: {
      type: QuestionType
      question: string
      order: number
      options: { text: string; isCorrect?: boolean | null; matchKey?: string | null; order?: number | null }[]
    }[]
  }[]
  assignment?: { description: string; submitUrl: string | null } | null
}

export async function importCourse(formData: FormData): Promise<string> {
  await assertAdmin()

  const file = formData.get("file") as File | null
  if (!file) throw new Error("No file provided.")

  let data: CourseExport
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!data?.course?.name) {
    throw new Error("This doesn't look like a course export file.")
  }

  const topicId = data.course.topicName
    ? (await prisma.topic.findFirst({ where: { name: data.course.topicName } }))?.id ?? null
    : null

  // Unique name: "{name}", then "{name} (imported)", "{name} (imported 2)"…
  const baseName = data.course.name
  let newName = baseName
  let suffix = 2
  while (await prisma.course.findFirst({ where: { name: newName, deletedAt: null } })) {
    newName = suffix === 2 ? `${baseName} (imported)` : `${baseName} (imported ${suffix})`
    suffix++
  }

  const newCourseId = await prisma.$transaction(async (tx) => {
    const newCourse = await tx.course.create({
      data: {
        name: newName,
        description: data.course.description ?? null,
        status: data.course.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        feedbackEnabled: data.course.feedbackEnabled ?? true,
        topicId,
      },
    })

    for (const c of data.contents ?? []) {
      let imageKey: string | null = null
      if (c.image?.data) {
        const saved = await saveContentImage(Buffer.from(c.image.data, "base64"))
        if ("error" in saved) throw new Error(`"${c.title}": ${saved.error}`)
        imageKey = saved.key
      }
      const content = await tx.content.create({
        data: {
          courseId: newCourse.id,
          title: c.title,
          type: c.type,
          value: c.value,
          duration: c.duration ?? null,
          order: c.order,
          imageKey,
        },
      })
      for (const pq of c.popQuizzes ?? []) {
        await tx.popQuiz.create({
          data: {
            contentId: content.id,
            time: pq.time,
            question: pq.question,
            options: { create: pq.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })) },
          },
        })
      }
    }

    for (const t of data.tests ?? []) {
      const test = await tx.test.create({
        data: { courseId: newCourse.id, title: t.title, order: t.order, passThreshold: t.passThreshold },
      })
      for (const q of t.questions) {
        await tx.question.create({
          data: {
            testId: test.id,
            type: q.type,
            question: q.question,
            order: q.order,
            options: {
              create: q.options.map((o) => ({
                text: o.text,
                isCorrect: o.isCorrect ?? null,
                matchKey: o.matchKey ?? null,
                order: o.order ?? null,
              })),
            },
          },
        })
      }
    }

    if (data.assignment) {
      await tx.assignment.create({
        data: { courseId: newCourse.id, description: data.assignment.description, submitUrl: data.assignment.submitUrl },
      })
    }

    return newCourse.id
  })

  revalidatePath("/admin/course")
  revalidatePath("/sme/course")
  return newCourseId
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
  for (const t of tests) await tx.test.update({ where: { id: t.id }, data: { order: t.order! + 1 } })
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
  for (const t of tests) await tx.test.update({ where: { id: t.id }, data: { order: t.order! - 1 } })
}

export type CourseItemKind = "CONTENT" | "TEST"

// Moves an existing Content/Test to sit right after the item currently at
// `insertAfterOrder` (0 = beginning), closing the gap it leaves behind and
// opening one at the new spot. No-op if it's already there.
async function moveCourseItemInTx(
  tx: Prisma.TransactionClient,
  courseId: string,
  item: { kind: CourseItemKind; id: string },
  insertAfterOrder: number,
) {
  const getOrder = (kind: CourseItemKind, id: string) =>
    kind === "CONTENT"
      ? tx.content.findUnique({ where: { id }, select: { order: true } })
      : tx.test.findUnique({ where: { id }, select: { order: true } })
  const setOrder = (kind: CourseItemKind, id: string, order: number) =>
    kind === "CONTENT" ? tx.content.update({ where: { id }, data: { order } }) : tx.test.update({ where: { id }, data: { order } })

  const current = await getOrder(item.kind, item.id)
  if (!current || current.order === null) return
  const oldOrder = current.order
  const target = insertAfterOrder + 1
  if (target === oldOrder) return

  // Park it out of the way so the shifts below don't touch it, close the gap
  // it leaves, then open a gap at the (possibly shifted) target and drop it in.
  await setOrder(item.kind, item.id, -1)
  await shiftCourseItemsDownAfter(tx, courseId, oldOrder)
  const adjustedTarget = target > oldOrder ? target - 1 : target
  await shiftCourseItemsUpFrom(tx, courseId, adjustedTarget)
  await setOrder(item.kind, item.id, adjustedTarget)
}

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

// Errors are returned rather than thrown: thrown messages are redacted in production.
export async function uploadContentImage(courseId: string, formData: FormData): Promise<{ key?: string; error?: string }> {
  const user = await getSessionUser()
  if (!user || !(await canEditCourse(user, courseId))) return { error: "You can't edit this course." }
  const file = formData.get("image")
  if (!(file instanceof File)) return { error: "No image received." }
  return saveContentImage(Buffer.from(await file.arrayBuffer()))
}

// Deletes image files that no live content uses any more. Duplicated courses share
// image files, so a file goes only when its last reference is gone.
async function deleteUnusedContentImages(keys: (string | null | undefined)[]) {
  for (const key of new Set(keys)) {
    if (!key || !isContentImageKey(key)) continue
    const inUse = await prisma.content.count({ where: { imageKey: key, deletedAt: null } })
    if (inUse === 0) await deleteContentImage(key)
  }
}

// Called by the content form for images uploaded but not saved (replaced before saving,
// or the form was cancelled). Only unreferenced files are removed.
export async function discardContentImages(courseId: string, keys: string[]) {
  const user = await getSessionUser()
  if (!user || !(await canEditCourse(user, courseId))) return
  await deleteUnusedContentImages(keys)
}

export async function createContent(courseId: string, data: ContentFormData) {
  const imageKey = contentImageKey(data)
  await prisma.$transaction(async (tx) => {
    const target = data.insertAfterOrder + 1
    await shiftCourseItemsUpFrom(tx, courseId, target)
    await tx.content.create({
      data: { courseId, title: data.title, type: data.type, value: data.value, order: target, duration: data.duration, imageKey },
    })
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateContent(id: string, courseId: string, data: ContentEditData) {
  const imageKey = contentImageKey(data)
  const previous = await prisma.content.findUnique({ where: { id }, select: { imageKey: true } })
  await Promise.all([
    prisma.content.update({
      where: { id },
      data: { title: data.title, type: data.type, value: data.value, duration: data.duration, imageKey },
    }),
    touchCourse(courseId),
  ])
  if (previous?.imageKey && previous.imageKey !== imageKey) await deleteUnusedContentImages([previous.imageKey])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteContent(id: string, courseId: string) {
  let removedImageKey: string | null = null
  await prisma.$transaction(async (tx) => {
    const content = await tx.content.findUnique({ where: { id }, select: { order: true, imageKey: true } })
    if (!content || content.order === null) return

    removedImageKey = content.imageKey
    await tx.content.update({ where: { id }, data: { deletedAt: new Date(), order: null, imageKey: null } })
    await shiftCourseItemsDownAfter(tx, courseId, content.order)
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  await deleteUnusedContentImages([removedImageKey])
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

export async function updateTest(testId: string, courseId: string, data: TestFormData & { insertAfterOrder: number }) {
  await prisma.$transaction(async (tx) => {
    await tx.test.update({ where: { id: testId }, data: { title: data.title, passThreshold: data.passThreshold } })
    await moveCourseItemInTx(tx, courseId, { kind: "TEST", id: testId }, data.insertAfterOrder)
    await tx.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } })
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function deleteTest(testId: string, courseId: string) {
  await prisma.$transaction(async (tx) => {
    const test = await tx.test.findUnique({ where: { id: testId }, select: { order: true } })
    if (!test || test.order === null) return

    await tx.test.update({ where: { id: testId }, data: { deletedAt: new Date(), order: null } })
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
      data: { courseId, description: data.description, submitUrl: data.submitUrl.trim() || null },
    }),
    touchCourse(courseId),
  ])
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateAssignment(assignmentId: string, courseId: string, data: AssignmentFormData) {
  await Promise.all([
    prisma.assignment.update({
      where: { id: assignmentId },
      data: { description: data.description, submitUrl: data.submitUrl.trim() || null },
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
