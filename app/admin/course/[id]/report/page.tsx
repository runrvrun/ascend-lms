import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCourseReportData } from "../../../../lib/courseReport"
import { CourseReport } from "./CourseReport"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await getCourseReportData(id)
  return { title: data ? `${data.course.name} — Report` : "Course Report" }
}

export default async function CourseReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getCourseReportData(id)
  if (!data) notFound()

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6 md:p-10">
      <CourseReport data={data} />
    </main>
  )
}
