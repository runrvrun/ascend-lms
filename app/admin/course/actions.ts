"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { ContentType, QuestionType } from "@prisma/client"

export type CourseFormData = {
  name: string
  description: string
}

export type ContentFormData = {
  title: string
  type: ContentType
  value: string
  order: number
}

export async function createCourse(data: CourseFormData) {
  await prisma.course.create({
    data: { name: data.name, description: data.description || null, status: "DRAFT" },
  })
  revalidatePath("/admin/course")
}

export async function toggleCourseStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  await prisma.course.update({ where: { id }, data: { status } })
  revalidatePath("/admin/course")
}

export async function updateCourse(id: string, data: CourseFormData) {
  await prisma.course.update({
    where: { id },
    data: { name: data.name, description: data.description || null },
  })
  revalidatePath("/admin/course")
  revalidatePath(`/admin/course/${id}`)
}

export async function deleteCourse(id: string) {
  await prisma.course.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/course")
}

export async function createContent(courseId: string, data: ContentFormData) {
  await prisma.content.create({
    data: { courseId, title: data.title, type: data.type, value: data.value, order: data.order },
  })
  revalidatePath(`/admin/course/${courseId}`)
}

export async function updateContent(id: string, courseId: string, data: ContentFormData) {
  await prisma.content.update({
    where: { id },
    data: { title: data.title, type: data.type, value: data.value, order: data.order },
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
