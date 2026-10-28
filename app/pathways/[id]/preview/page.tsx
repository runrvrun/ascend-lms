import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { ArrowLeft, BookOpen, ClipboardCheck, ClipboardList, FileText, User } from "lucide-react"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { SidebarWithStats } from "../../../components/SidebarWithStats"
import { PreviewActions } from "./PreviewActions"
import { SampleContent } from "./SampleContent"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const pathway = await prisma.pathway.findUnique({ where: { id }, select: { name: true } })
  return { title: pathway ? `Preview: ${pathway.name}` : "Pathway Preview" }
}

// Learner-facing preview: pathway + course outline, trainers, and only the first
// content item of the first course. Nothing else's content is sent to the client.
export default async function PathwayPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")
  const userId = (session.user as any).id as string

  const [pathway, enrollment] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null, status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        tags: true,
        courses: {
          where: { course: { deletedAt: null, status: "PUBLISHED" } },
          orderBy: { order: "asc" },
          select: {
            course: {
              select: {
                id: true,
                name: true,
                description: true,
                trainers: {
                  where: { user: { deletedAt: null } },
                  select: { user: { select: { id: true, name: true } } },
                },
                contents: {
                  where: { deletedAt: null },
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, type: true },
                },
                _count: {
                  select: { tests: { where: { deletedAt: null } } },
                },
                assignment: { where: { deletedAt: null }, select: { id: true } },
              },
            },
          },
        },
      },
    }),
    prisma.pathwayEnrollment.findUnique({
      where: { userId_pathwayId: { userId, pathwayId: id } },
      select: { status: true },
    }),
  ])

  if (!pathway) notFound()
  // Hidden pathways are invite-only; only people already enrolled may preview them.
  if (pathway.visibility === "HIDDEN" && !enrollment) notFound()

  const courses = pathway.courses.map((pc) => pc.course)
  const firstCourse = courses[0]
  const firstContentId = firstCourse?.contents[0]?.id
  const sampleContent = firstContentId
    ? await prisma.content.findUnique({
        where: { id: firstContentId },
        select: { id: true, title: true, type: true, value: true, order: true, duration: true },
      })
    : null

  const trainerNames = [...new Map(courses.flatMap((c) => c.trainers.map((t) => [t.user.id, t.user.name]))).values()]
    .filter((n): n is string => !!n)

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
        <a href="/pathways" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} />
          Back to Pathways
        </a>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Preview</span>
            {pathway.visibility === "PUBLIC_APPROVAL" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Approval required</span>
            ) : pathway.visibility === "PUBLIC_FREE" ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Free enroll</span>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{pathway.name}</h1>
          {pathway.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{pathway.description}</p>
          )}
          {pathway.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pathway.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{tag}</span>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} />
              {courses.length} course{courses.length !== 1 ? "s" : ""}
            </span>
            {trainerNames.length > 0 && (
              <span className="flex items-center gap-1.5">
                <User size={13} />
                {trainerNames.join(", ")}
              </span>
            )}
          </div>
          <div className="mt-5">
            <PreviewActions
              pathway={{ id: pathway.id, name: pathway.name, visibility: pathway.visibility }}
              enrollmentStatus={enrollment?.status ?? null}
            />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Courses</h2>
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
              No courses in this pathway yet.
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {courses.map((course, i) => (
                <li key={course.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">{course.name}</h3>
                      {course.description && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{course.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <FileText size={12} />
                          {course.contents.length} content item{course.contents.length !== 1 ? "s" : ""}
                        </span>
                        {course._count.tests > 0 && (
                          <span className="flex items-center gap-1">
                            <ClipboardCheck size={12} />
                            {course._count.tests} test{course._count.tests !== 1 ? "s" : ""}
                          </span>
                        )}
                        {course.assignment && (
                          <span className="flex items-center gap-1">
                            <ClipboardList size={12} />
                            Assignment
                          </span>
                        )}
                        {course.trainers.length > 0 && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            Trainer{course.trainers.length !== 1 ? "s" : ""}: {course.trainers.map((t) => t.user.name).filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {sampleContent && firstCourse && (
          <section>
            <h2 className="mb-1 text-sm font-semibold text-slate-700">Sample content</h2>
            <p className="mb-3 text-xs text-slate-400">
              The first item of {firstCourse.name}. Enroll to access the full pathway.
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SampleContent
                pathwayId={pathway.id}
                courseId={firstCourse.id}
                currentUserId={userId}
                content={sampleContent}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
