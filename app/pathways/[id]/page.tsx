import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { prisma } from "../../lib/prisma"
import { isPathwayOwner } from "../../lib/permissions"
import { SidebarWithStats } from "../../components/SidebarWithStats"
import { PathwayViewer } from "./PathwayViewer"
import { isDeadlineLocked, toDeadlineInput } from "../../lib/pathwayDeadline"
import { evaluateCourseCompletion } from "../../lib/courseCompletion"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const pathway = await prisma.pathway.findUnique({ where: { id }, select: { name: true } })
  return { title: pathway?.name ?? "Pathway" }
}

export default async function PathwayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ preview?: string; course?: string }>
}) {
  const { id } = await params
  const { preview, course: initialCourseId } = await searchParams
  const isPreviewMode = preview === "1"

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  // In preview mode (drafts and unpublished courses visible), verify the user is
  // privileged: admin, trainer, SME, or an owner of this pathway
  if (isPreviewMode) {
    const roles = ((session.user as any).roles as string[]) ?? []
    const isPrivileged =
      ["ADMIN", "TRAINER", "SME"].some((r) => roles.includes(r)) || (await isPathwayOwner(userId, id))
    if (!isPrivileged) redirect("/pathways")
  }

  const [pathway, enrollment, completedRecords, courseProgressRecords, testProgressRecords, assignmentSubmissions, courseFeedbacks, allGrowthPlanRecords] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null, ...(isPreviewMode ? {} : { status: "PUBLISHED" }) },
      include: {
        courses: {
          where: { course: { deletedAt: null, ...(isPreviewMode ? {} : { status: "PUBLISHED" }) } },
          orderBy: { order: "asc" },
          include: {
            course: {
              include: {
                contents: {
                  where: { deletedAt: null },
                  orderBy: { order: "asc" },
                  include: {
                    popQuizzes: {
                      where: { deletedAt: null },
                      orderBy: { time: "asc" },
                      select: {
                        id: true,
                        time: true,
                        question: true,
                        options: { orderBy: { order: "asc" }, select: { id: true, text: true } },
                      },
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
                      include: { options: true },
                    },
                  },
                },
                assignment: {
                  where: { deletedAt: null },
                  select: { id: true, description: true, submitUrl: true },
                },
              },
            },
          },
        },
      },
    }),
    isPreviewMode ? Promise.resolve(null) : prisma.pathwayEnrollment.findUnique({
      where: { userId_pathwayId: { userId, pathwayId: id } },
      select: { status: true, deadline: true },
    }),
    isPreviewMode ? Promise.resolve([]) : prisma.contentProgress.findMany({
      where: { userId, pathwayId: id },
      select: { contentId: true },
    }),
    isPreviewMode ? Promise.resolve([]) : prisma.courseProgress.findMany({
      where: { userId, pathwayId: id },
      select: { courseId: true, completed: true, assignmentStatus: true },
    }),
    isPreviewMode ? Promise.resolve([]) : prisma.testProgress.findMany({
      where: { userId, pathwayId: id },
      select: { testId: true, status: true },
    }),
    isPreviewMode ? Promise.resolve([]) : prisma.assignmentSubmission.findMany({
      where: { userId, pathwayId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        assignmentId: true,
        submissionUrl: true,
        fileName: true,
        fileDeletedAt: true,
        grade: true,
        status: true,
        adminNote: true,
        createdAt: true,
      },
    }),
    isPreviewMode ? Promise.resolve([]) : prisma.courseFeedback.findMany({
      where: { userId, pathwayId: id },
      select: { courseId: true, rating: true, comment: true },
    }),
    prisma.growthPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        completedAt: true,
        confirmedAt: true,
        pathwayId: true,
        pathway: { select: { name: true } },
      },
    }),
  ])

  if (!pathway) notFound()
  if (!isPreviewMode && enrollment?.status !== "APPROVED") redirect("/pathways")

  const completedContentIds = new Set((completedRecords as { contentId: string }[]).map((r) => r.contentId))
  const completedCourseIds = new Set((courseProgressRecords as { courseId: string; completed: boolean }[]).filter((r) => r.completed).map((r) => r.courseId))
  const testStatusByTestId: Record<string, "PASSED" | "FAILED"> = {}
  const assignmentStatusByCourseId: Record<string, "PASSED" | "FAILED"> = {}
  for (const r of testProgressRecords as { testId: string; status: string }[]) {
    testStatusByTestId[r.testId] = r.status as "PASSED" | "FAILED"
  }
  for (const r of courseProgressRecords as { courseId: string; assignmentStatus: string | null }[]) {
    if (r.assignmentStatus) assignmentStatusByCourseId[r.courseId] = r.assignmentStatus as "PASSED" | "FAILED"
  }

  // A course can look finished but still be marked incomplete, e.g. when the one item the
  // learner hadn't done was deleted before the delete-time re-check existed. Re-check those.
  if (!isPreviewMode && enrollment?.status === "APPROVED") {
    const passedAssignmentIds = new Set(assignmentSubmissions.filter((s) => s.status === "PASSED").map((s) => s.assignmentId))
    const looksDone = pathway.courses.filter(
      ({ course }) =>
        !completedCourseIds.has(course.id) &&
        course.contents.length + course.tests.length > 0 &&
        course.contents.every((c) => completedContentIds.has(c.id)) &&
        course.tests.every((t) => testStatusByTestId[t.id] === "PASSED") &&
        (!course.assignment || passedAssignmentIds.has(course.assignment.id))
    )
    for (const { course } of looksDone) {
      if (await evaluateCourseCompletion(userId, course.id, id)) completedCourseIds.add(course.id)
    }
  }

  const isPathwayComplete =
    !isPreviewMode &&
    pathway.courses.length > 0 &&
    pathway.courses.every((entry) => completedCourseIds.has(entry.course.id))

  const normalizedPathway = {
    ...pathway,
    courses: pathway.courses.map((entry) => ({
      ...entry,
      course: { ...entry.course, tests: entry.course.tests.map((t) => ({ ...t, order: t.order! })) },
    })),
  }

  const latestSubmissionByAssignmentId: Record<string, (typeof assignmentSubmissions)[0]> = {}
  for (const sub of assignmentSubmissions as typeof assignmentSubmissions) {
    if (!latestSubmissionByAssignmentId[sub.assignmentId]) {
      latestSubmissionByAssignmentId[sub.assignmentId] = sub
    }
  }

  const feedbackByCourseId: Record<string, { rating: number; comment: string | null }> = {}
  for (const f of courseFeedbacks as { courseId: string; rating: number; comment: string | null }[]) {
    feedbackByCourseId[f.courseId] = { rating: f.rating, comment: f.comment }
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />
      <PathwayViewer
        pathway={normalizedPathway}
        completedContentIds={completedContentIds}
        completedCourseIds={completedCourseIds}
        isPathwayComplete={isPathwayComplete}
        currentUserId={userId}
        latestSubmissionByAssignmentId={latestSubmissionByAssignmentId}
        testStatusByTestId={testStatusByTestId}
        assignmentStatusByCourseId={assignmentStatusByCourseId}
        feedbackByCourseId={feedbackByCourseId}
        allGrowthPlans={allGrowthPlanRecords.map((g) => ({
          id: g.id,
          title: g.title,
          completedAt: g.completedAt,
          confirmedAt: g.confirmedAt,
          pathwayId: g.pathwayId,
          pathwayName: g.pathway?.name ?? null,
        }))}
        deadline={enrollment?.deadline ? toDeadlineInput(enrollment.deadline) : null}
        isLocked={!isPreviewMode && isDeadlineLocked(enrollment?.deadline ?? null)}
        isPreview={isPreviewMode}
        backHref={isPreviewMode ? "/admin/pathway" : "/pathways"}
        backLabel={isPreviewMode ? "Pathways (Admin)" : "Pathways"}
        initialCourseId={initialCourseId}
      />
    </div>
  )
}
