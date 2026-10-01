import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { prisma } from "../../../../lib/prisma"
import { readAssignmentFile } from "../../../../lib/assignmentFiles"

// Streams an uploaded assignment file. Visible to the submitter, admins, the
// course's trainers, and SMEs of the course's topic — the same people who can
// open the submissions panel.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })
  const userId = (session.user as any).id as string
  const roles = ((session.user as any).roles as string[]) ?? []

  const { id } = await params
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id },
    select: {
      userId: true,
      fileKey: true,
      fileName: true,
      fileDeletedAt: true,
      assignment: { select: { course: { select: { id: true, topicId: true } } } },
    },
  })
  if (!submission?.fileKey) return new NextResponse("Not found", { status: 404 })

  const course = submission.assignment.course
  const allowed =
    submission.userId === userId ||
    roles.includes("ADMIN") ||
    !!(await prisma.courseTrainer.findUnique({ where: { courseId_userId: { courseId: course.id, userId } } })) ||
    (!!course.topicId &&
      !!(await prisma.topicSME.findUnique({ where: { topicId_userId: { topicId: course.topicId, userId } } })))
  if (!allowed) return new NextResponse("Forbidden", { status: 403 })

  if (submission.fileDeletedAt) {
    return new NextResponse("This file was removed after the 6-month retention period.", { status: 410 })
  }

  let file
  try {
    file = await readAssignmentFile(submission.fileKey)
  } catch {
    return new NextResponse("File not found on server", { status: 404 })
  }

  const name = submission.fileName ?? submission.fileKey
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
