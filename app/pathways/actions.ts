"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"

async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  return session
}

async function awardCoursePoints(userId: string, courseId: string, pathwayId: string) {
  // Use referenceId to ensure points are only awarded once per course+pathway
  const referenceId = `${courseId}:${pathwayId}`
  const already = await prisma.userPoint.findFirst({
    where: { userId, source: "COURSE_COMPLETION", referenceId },
  })
  if (already) return

  const pathwayCourse = await prisma.pathwayCourse.findUnique({
    where: { pathwayId_courseId: { pathwayId, courseId } },
    select: { points: true },
  })
  if (!pathwayCourse) return

  await prisma.userPoint.create({
    data: { userId, points: pathwayCourse.points, source: "COURSE_COMPLETION", referenceId },
  })
}

async function checkCourseCompletion(userId: string, courseId: string, pathwayId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      contents: { where: { deletedAt: null }, select: { id: true } },
      test: { where: { deletedAt: null }, select: { id: true } },
    },
  })
  if (!course) return

  // Courses with a test are completed via submitTest, not here
  if (course.test) return

  if (course.contents.length === 0) return

  const completedCount = await prisma.contentProgress.count({
    where: { userId, pathwayId, contentId: { in: course.contents.map((c) => c.id) } },
  })

  if (completedCount === course.contents.length) {
    await prisma.courseProgress.upsert({
      where: { userId_courseId_pathwayId: { userId, courseId, pathwayId } },
      create: { userId, courseId, pathwayId, completed: true, completedAt: new Date() },
      update: { completed: true, completedAt: new Date() },
    })
    await awardCoursePoints(userId, courseId, pathwayId)
  }
}

export async function enrollPathway(pathwayId: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  await prisma.pathwayEnrollment.upsert({
    where: { userId_pathwayId: { userId, pathwayId } },
    create: { userId, pathwayId, type: "SELF_ENROLL", status: "APPROVED" },
    update: { type: "SELF_ENROLL", status: "APPROVED", rejectionReason: null },
  })
  revalidatePath("/pathways")
  revalidatePath("/dashboard")
}

export async function toggleContentComplete(contentId: string, pathwayId: string, completed: boolean) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  if (completed) {
    await prisma.contentProgress.upsert({
      where: { userId_contentId_pathwayId: { userId, contentId, pathwayId } },
      create: { userId, contentId, pathwayId },
      update: { completedAt: new Date() },
    })
    const content = await prisma.content.findUnique({ where: { id: contentId }, select: { courseId: true } })
    if (content) {
      await checkCourseCompletion(userId, content.courseId, pathwayId)
    }
  } else {
    await prisma.contentProgress.deleteMany({ where: { userId, contentId, pathwayId } })
    // If content is unchecked, un-complete the course so it can be re-evaluated
    const content = await prisma.content.findUnique({ where: { id: contentId }, select: { courseId: true } })
    if (content) {
      await prisma.courseProgress.updateMany({
        where: { userId, courseId: content.courseId, pathwayId },
        data: { completed: false, completedAt: null },
      })
    }
  }
  revalidatePath(`/pathways/${pathwayId}`)
}

export async function submitTest(
  testId: string,
  courseId: string,
  pathwayId: string,
  answers: Record<string, string | string[]>
) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: { options: true },
      },
    },
  })
  if (!test) throw new Error("Test not found")

  let correct = 0
  const wrongAnswers: { question: string; userAnswer: string; correctAnswer: string }[] = []

  for (const q of test.questions) {
    const userAnswer = answers[q.id]
    const optMap = Object.fromEntries(q.options.map((o) => [o.id, o.text]))
    let isCorrect = false

    if (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") {
      const option = q.options.find((o) => o.id === userAnswer)
      isCorrect = !!option?.isCorrect
      if (!isCorrect) {
        wrongAnswers.push({
          question: q.question,
          userAnswer: optMap[userAnswer as string] ?? "No answer",
          correctAnswer: q.options.find((o) => o.isCorrect)?.text ?? "",
        })
      }
    } else if (q.type === "FILL_BLANK") {
      const correctOpt = q.options.find((o) => o.isCorrect)
      isCorrect =
        !!correctOpt &&
        typeof userAnswer === "string" &&
        userAnswer.trim().toLowerCase() === correctOpt.text.trim().toLowerCase()
      if (!isCorrect) {
        wrongAnswers.push({
          question: q.question,
          userAnswer: typeof userAnswer === "string" && userAnswer.trim() ? userAnswer : "No answer",
          correctAnswer: correctOpt?.text ?? "",
        })
      }
    } else if (q.type === "RANKING") {
      const userOrder = Array.isArray(userAnswer) ? userAnswer : []
      const correctOrder = [...q.options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder.map((o) => o.id))
      if (!isCorrect) {
        wrongAnswers.push({
          question: q.question,
          userAnswer: userOrder.map((id, i) => `${i + 1}. ${optMap[id] ?? id}`).join(" → "),
          correctAnswer: correctOrder.map((o, i) => `${i + 1}. ${o.text}`).join(" → "),
        })
      }
    } else if (q.type === "MATCHING") {
      try {
        const userMatches: Record<string, string> =
          typeof userAnswer === "string" ? JSON.parse(userAnswer) : {}
        isCorrect = q.options.every((o) => o.matchKey && userMatches[o.id] === o.matchKey)
        if (!isCorrect) {
          wrongAnswers.push({
            question: q.question,
            userAnswer: q.options.map((o) => `${o.text} → ${userMatches[o.id] ?? "?"}`).join(", "),
            correctAnswer: q.options.map((o) => `${o.text} → ${o.matchKey}`).join(", "),
          })
        }
      } catch {
        wrongAnswers.push({
          question: q.question,
          userAnswer: "Invalid answer",
          correctAnswer: q.options.map((o) => `${o.text} → ${o.matchKey}`).join(", "),
        })
      }
    }

    if (isCorrect) correct++
  }

  const total = test.questions.length
  const score = total > 0 ? (correct / total) * 100 : 0
  const passed = score >= test.passThreshold

  let courseCompleted = false
  if (passed) {
    // Check if all course contents are also completed
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { contents: { where: { deletedAt: null }, select: { id: true } } },
    })
    const completedContentsCount = course?.contents.length
      ? await prisma.contentProgress.count({
          where: { userId, pathwayId, contentId: { in: course.contents.map((c) => c.id) } },
        })
      : 0
    const allContentsComplete =
      !course?.contents.length || completedContentsCount === course.contents.length

    if (allContentsComplete) {
      await prisma.courseProgress.upsert({
        where: { userId_courseId_pathwayId: { userId, courseId, pathwayId } },
        create: { userId, courseId, pathwayId, completed: true, score, completedAt: new Date() },
        update: { completed: true, score, completedAt: new Date() },
      })
      await awardCoursePoints(userId, courseId, pathwayId)
      courseCompleted = true
    }
  }

  revalidatePath(`/pathways/${pathwayId}`)
  return {
    score: Math.round(score),
    passed,
    passThreshold: test.passThreshold,
    correct,
    total,
    courseCompleted,
    wrongAnswers,
  }
}

export async function requestPathway(pathwayId: string, note: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  await prisma.pathwayEnrollment.upsert({
    where: { userId_pathwayId: { userId, pathwayId } },
    create: { userId, pathwayId, type: "USER_REQUEST", status: "PENDING", note },
    update: { type: "USER_REQUEST", status: "PENDING", note, rejectionReason: null },
  })
  revalidatePath("/pathways")
  revalidatePath("/dashboard")
}

export async function unenrollPathway(pathwayId: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  await prisma.pathwayEnrollment.delete({
    where: { userId_pathwayId: { userId, pathwayId } },
  })
  revalidatePath("/pathways")
  revalidatePath("/dashboard")
}
