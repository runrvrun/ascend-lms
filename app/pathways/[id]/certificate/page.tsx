import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { prisma } from "../../../lib/prisma"
import { CertificateView } from "./CertificateView"

export const metadata: Metadata = { title: "Certificate" }

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const [pathway, enrollment, courseProgressRecords, user] = await Promise.all([
    prisma.pathway.findFirst({
      where: { id, deletedAt: null, status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        courses: {
          where: { course: { status: "PUBLISHED", deletedAt: null } },
          select: { courseId: true },
        },
      },
    }),
    prisma.pathwayEnrollment.findUnique({
      where: { userId_pathwayId: { userId, pathwayId: id } },
      select: { status: true },
    }),
    prisma.courseProgress.findMany({
      where: { userId, pathwayId: id, completed: true },
      select: { courseId: true, completedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
  ])

  if (!pathway) notFound()
  if (enrollment?.status !== "APPROVED") redirect(`/pathways/${id}`)

  const completedCourseIds = new Set(courseProgressRecords.map((r) => r.courseId))
  const isComplete =
    pathway.courses.length > 0 &&
    pathway.courses.every((c) => completedCourseIds.has(c.courseId))

  if (!isComplete) redirect(`/pathways/${id}`)

  // Use the latest completedAt as the certificate date
  const completedAt = courseProgressRecords
    .map((r) => r.completedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date()

  return (
    <CertificateView
      userName={user?.name ?? "Learner"}
      pathwayName={pathway.name}
      completedAt={completedAt}
      pathwayId={pathway.id}
    />
  )
}
