"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { NotificationType } from "@prisma/client"
import { sendNewEnrollmentRequest, sendPathwayShared } from "../lib/email"
import { evaluateCourseCompletion } from "../lib/courseCompletion"
import { validateAssignmentFile, saveAssignmentFile, deleteAssignmentFile } from "../lib/assignmentFiles"
import { isDeadlineLocked, DEADLINE_GRACE_DAYS } from "../lib/pathwayDeadline"

async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Not authenticated")
  return session
}

const LOCKED_MESSAGE = `This pathway closed ${DEADLINE_GRACE_DAYS} days after its deadline. You can still view the content, but progress can no longer be recorded.`

// Null if the learner can still make progress in this pathway, otherwise the reason.
async function pathwayLockedReason(userId: string, pathwayId: string) {
  const enrollment = await prisma.pathwayEnrollment.findUnique({
    where: { userId_pathwayId: { userId, pathwayId } },
    select: { deadline: true },
  })
  return isDeadlineLocked(enrollment?.deadline ?? null) ? LOCKED_MESSAGE : null
}

export async function enrollPathway(pathwayId: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  const pathway = await prisma.pathway.findUnique({ where: { id: pathwayId }, select: { visibility: true } })
  if (pathway?.visibility !== "PUBLIC_FREE") throw new Error("This pathway is not open for self-enrollment.")

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
  const locked = await pathwayLockedReason(userId, pathwayId)
  if (locked) throw new Error(locked)

  if (completed) {
    await prisma.contentProgress.upsert({
      where: { userId_contentId_pathwayId: { userId, contentId, pathwayId } },
      create: { userId, contentId, pathwayId },
      update: { completedAt: new Date() },
    })
    const content = await prisma.content.findUnique({ where: { id: contentId }, select: { courseId: true } })
    if (content) {
      await evaluateCourseCompletion(userId, content.courseId, pathwayId)
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

export async function checkPopQuizAnswer(popQuizId: string, optionId: string): Promise<boolean> {
  await getSession()
  const option = await prisma.popQuizOption.findFirst({
    where: { id: optionId, popQuizId },
    select: { isCorrect: true },
  })
  return option?.isCorrect ?? false
}

export async function submitTest(
  testId: string,
  courseId: string,
  pathwayId: string,
  answers: Record<string, string | string[]>
) {
  const session = await getSession()
  const userId = (session.user as any).id as string
  const locked = await pathwayLockedReason(userId, pathwayId)
  if (locked) throw new Error(locked)

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
  const testStatus = passed ? ("PASSED" as const) : ("FAILED" as const)

  // Always persist score + status so the UI can reflect this test's state independently
  await prisma.testProgress.upsert({
    where: { userId_testId_pathwayId: { userId, testId, pathwayId } },
    create: { userId, testId, pathwayId, score, status: testStatus },
    update: { score, status: testStatus, completedAt: new Date() },
  })

  const courseCompleted = passed ? await evaluateCourseCompletion(userId, courseId, pathwayId) : false

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

  const target = await prisma.pathway.findUnique({ where: { id: pathwayId }, select: { visibility: true } })
  if (target?.visibility !== "PUBLIC_APPROVAL") throw new Error("This pathway does not accept enrollment requests.")

  const [, user, pathway] = await Promise.all([
    prisma.pathwayEnrollment.upsert({
      where: { userId_pathwayId: { userId, pathwayId } },
      create: { userId, pathwayId, type: "USER_REQUEST", status: "PENDING", note },
      update: { type: "USER_REQUEST", status: "PENDING", note, rejectionReason: null },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        managers: { select: { manager: { select: { id: true, name: true, email: true } } } },
      },
    }),
    prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } }),
  ])

  revalidatePath("/pathways")
  revalidatePath("/dashboard")

  if (user?.managers.length && pathway) {
    const requesterName = user.name ?? user.email ?? "A team member"
    await Promise.all(
      user.managers.map(async ({ manager }) => {
        await Promise.all([
          manager.email
            ? sendNewEnrollmentRequest(
                manager.email,
                manager.name ?? manager.email,
                requesterName,
                pathway.name,
                note
              )
            : Promise.resolve(),
          prisma.notification.create({
            data: {
              userId: manager.id,
              type: "ENROLLMENT_REQUESTED",
              message: `${requesterName} has requested enrollment in "${pathway.name}". Please review their request.`,
              pathwayId,
            },
          }),
        ])
      })
    )
    revalidatePath("/notifications")
  }
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

// Submits either a link (`url`) or an uploaded file (`file`) from FormData.
export async function submitAssignment(formData: FormData): Promise<{ error?: string }> {
  const session = await getSession()
  const userId = (session.user as any).id as string
  const userName = session.user?.name ?? "A user"

  const assignmentId = String(formData.get("assignmentId") ?? "")
  const pathwayId = String(formData.get("pathwayId") ?? "")
  const url = String(formData.get("url") ?? "").trim()
  const file = formData.get("file")

  const locked = await pathwayLockedReason(userId, pathwayId)
  if (locked) return { error: locked }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    include: {
      course: {
        select: { name: true, trainers: { select: { userId: true } } },
      },
    },
  })
  if (!assignment) return { error: "Assignment not found." }

  if (file instanceof File && file.size > 0) {
    const invalid = validateAssignmentFile(file)
    if (invalid) return { error: invalid }
    const fileKey = await saveAssignmentFile(file)
    try {
      await prisma.assignmentSubmission.create({
        data: { assignmentId, userId, pathwayId, fileKey, fileName: file.name, fileSize: file.size, status: "SUBMITTED" },
      })
    } catch (err) {
      await deleteAssignmentFile(fileKey)
      throw err
    }
  } else if (/^https?:\/\//i.test(url)) {
    await prisma.assignmentSubmission.create({
      data: { assignmentId, userId, pathwayId, submissionUrl: url, status: "SUBMITTED" },
    })
  } else {
    return { error: "Please choose a file or paste a valid link." }
  }

  if (assignment.course.trainers.length) {
    await prisma.notification.createMany({
      data: assignment.course.trainers.map((t) => ({
        userId: t.userId,
        type: NotificationType.ASSIGNMENT_SUBMITTED,
        message: `${userName} submitted an assignment for "${assignment.course.name}".`,
      })),
    })
    revalidatePath("/notifications")
  }

  revalidatePath(`/pathways/${pathwayId}`)
  return {}
}

export async function submitCourseFeedback(courseId: string, pathwayId: string, rating: number, comment: string) {
  const session = await getSession()
  const userId = (session.user as any).id as string

  await prisma.courseFeedback.upsert({
    where: { userId_courseId_pathwayId: { userId, courseId, pathwayId } },
    create: { userId, courseId, pathwayId, rating, comment: comment || null },
    update: { rating, comment: comment || null },
  })

  revalidatePath(`/pathways/${pathwayId}`)
}

// Active users other than the current one, for the share picker. Loaded when the
// share dialog opens rather than with every pathways page render.
export async function getShareRecipients(): Promise<{ value: string; label: string }[]> {
  const session = await getSession()
  const userId = (session.user as any).id as string
  const users = await prisma.user.findMany({
    where: { deletedAt: null, id: { not: userId } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })
  return users.map((u) => ({
    value: u.id,
    label: u.name && u.email ? `${u.name} (${u.email})` : (u.name ?? u.email ?? u.id),
  }))
}

const SHARE_COOLDOWN_MS = 24 * 60 * 60 * 1000

// Sends an in-app notification + email linking to the pathway preview.
// Sharing never enrolls the recipient.
export async function sharePathway(pathwayId: string, recipientId: string): Promise<{ error?: string }> {
  const session = await getSession()
  const userId = (session.user as any).id as string
  if (recipientId === userId) return { error: "You can't share a pathway with yourself." }

  const [pathway, sharer, recipient] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id: pathwayId, deletedAt: null, status: "PUBLISHED", visibility: { not: "HIDDEN" } },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.user.findFirst({
      where: { id: recipientId, deletedAt: null },
      select: { id: true, name: true, email: true },
    }),
  ])
  if (!pathway) return { error: "This pathway can't be shared." }
  if (!recipient) return { error: "That user is not available." }

  const recentShare = await prisma.notification.findFirst({
    where: {
      userId: recipient.id,
      type: NotificationType.PATHWAY_SHARED,
      pathwayId,
      relatedUserId: userId,
      createdAt: { gte: new Date(Date.now() - SHARE_COOLDOWN_MS) },
    },
    select: { id: true },
  })
  if (recentShare) return { error: `You already shared this pathway with ${recipient.name ?? "this user"} today.` }

  const sharerName = sharer?.name ?? sharer?.email ?? "A colleague"
  await prisma.notification.create({
    data: {
      userId: recipient.id,
      type: NotificationType.PATHWAY_SHARED,
      message: `${sharerName} shared the pathway "${pathway.name}" with you.`,
      pathwayId,
      relatedUserId: userId,
    },
  })
  if (recipient.email) {
    await sendPathwayShared(recipient.email, recipient.name ?? recipient.email, sharerName, pathway.name, pathwayId)
  }
  return {}
}
