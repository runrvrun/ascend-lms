import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../auth/[...nextauth]/route"
import { prisma } from "../../../../../lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const roles = ((session?.user as any)?.roles as string[]) ?? []
  if (!session?.user || !roles.includes("ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params

  const course = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      topic: { select: { name: true } },
      contents: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          popQuizzes: {
            where: { deletedAt: null },
            orderBy: { time: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
      tests: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          questions: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
      assignment: { where: { deletedAt: null }, select: { description: true, submitUrl: true } },
    },
  })
  if (!course) {
    return new NextResponse("Course not found", { status: 404 })
  }

  // Deliberately excludes anything user/environment-specific: no ids, no
  // CourseTrainer (user accounts won't line up across environments), no
  // pathway links, no progress/submission/feedback data.
  const exportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    course: {
      name: course.name,
      description: course.description,
      status: course.status,
      feedbackEnabled: course.feedbackEnabled,
      topicName: course.topic?.name ?? null,
    },
    contents: course.contents.map((c) => ({
      title: c.title,
      type: c.type,
      value: c.value,
      duration: c.duration,
      order: c.order,
      popQuizzes: c.popQuizzes.map((pq) => ({
        time: pq.time,
        question: pq.question,
        options: pq.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })),
      })),
    })),
    tests: course.tests.map((t) => ({
      title: t.title,
      order: t.order,
      passThreshold: t.passThreshold,
      questions: t.questions.map((q) => ({
        type: q.type,
        question: q.question,
        order: q.order,
        options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, matchKey: o.matchKey, order: o.order })),
      })),
    })),
    assignment: course.assignment
      ? { description: course.assignment.description, submitUrl: course.assignment.submitUrl }
      : null,
  }

  const safeName = course.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${safeName}-export.json"`,
    },
  })
}
