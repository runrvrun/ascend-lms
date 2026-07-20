import { NextResponse } from "next/server"
import * as xlsx from "xlsx"
import { getCourseReportData } from "../../../../../../lib/courseReport"

function fmtDate(d: Date | string | null) {
  if (!d) return ""
  return new Date(d).toISOString().slice(0, 10)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const data = await getCourseReportData(id)
  if (!data) {
    return new NextResponse("Course not found", { status: 404 })
  }

  const { course, stats, users, feedbacks } = data
  const wb = xlsx.utils.book_new()

  // ── Overview ─────────────────────────────────────────────────────────────
  const overviewRows: (string | number)[][] = [
    ["Course Report", course.name],
    [],
    ["Status", course.status === "PUBLISHED" ? "Published" : "Draft"],
    ["Topic", course.topic ?? "—"],
    ["Trainers", course.trainers.join(", ") || "—"],
    ["Content Items", course.contentCount],
    ["Has Test", course.hasTest ? "Yes" : "No"],
    ["Has Assignment", course.hasAssignment ? "Yes" : "No"],
    ["Used in Pathways", course.pathwayCount],
    [],
    ["Enrolled", stats.enrolledCount],
    ["Completed", stats.completedCount],
    ["In Progress", stats.inProgressCount],
    ["Completion Rate", `${stats.completionRate}%`],
    ["Average Test Score", stats.avgTestScore != null ? `${stats.avgTestScore}%` : "—"],
    ["Average Feedback Rating", stats.avgFeedbackRating != null ? `${stats.avgFeedbackRating} / 5` : "—"],
  ]
  const wsOverview = xlsx.utils.aoa_to_sheet(overviewRows)
  wsOverview["!cols"] = [{ wch: 24 }, { wch: 30 }]
  xlsx.utils.book_append_sheet(wb, wsOverview, "Overview")

  // ── Users ────────────────────────────────────────────────────────────────
  const userRows: (string | number)[][] = [
    ["Name", "Email", "Division", "Office", "Pathway(s)", "Enroll Date", "Completion Status", "Complete Date", "Time Taken (days)", "Test Score (%)", "Test Status"],
    ...users.map((u) => [
      u.name ?? "",
      u.email ?? "",
      u.division,
      u.office ?? "",
      u.pathwayNames.join(", "),
      fmtDate(u.enrollDate),
      u.completed ? "Completed" : "In Progress",
      fmtDate(u.completedAt),
      u.timeTakenDays ?? "",
      u.testScore != null ? Math.round(u.testScore) : "",
      u.testStatus ?? "",
    ]),
  ]
  const wsUsers = xlsx.utils.aoa_to_sheet(userRows)
  wsUsers["!cols"] = [
    { wch: 25 }, { wch: 32 }, { wch: 12 }, { wch: 22 }, { wch: 28 },
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
  ]
  xlsx.utils.book_append_sheet(wb, wsUsers, "Users")

  // ── Tests ────────────────────────────────────────────────────────────────
  const testRows: (string | number)[][] = course.hasTest
    ? [
        ["Test Name", "Attempts", "Passed", "Average Score (%)"],
        [`${course.name} Test`, stats.testAttemptCount, stats.testPassedCount, stats.avgTestScore ?? ""],
      ]
    : [["No test configured for this course."]]
  const wsTests = xlsx.utils.aoa_to_sheet(testRows)
  wsTests["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 18 }]
  xlsx.utils.book_append_sheet(wb, wsTests, "Tests")

  // ── Assignment ───────────────────────────────────────────────────────────
  const assignmentRows: (string | number)[][] = course.hasAssignment
    ? [
        ["Assignment Name", "Submitted", "Passed"],
        [`${course.name} Assignment`, stats.assignmentSubmittedCount, stats.assignmentPassedCount],
      ]
    : [["No assignment configured for this course."]]
  const wsAssignment = xlsx.utils.aoa_to_sheet(assignmentRows)
  wsAssignment["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }]
  xlsx.utils.book_append_sheet(wb, wsAssignment, "Assignment")

  // ── Feedback ─────────────────────────────────────────────────────────────
  const feedbackRows: (string | number)[][] =
    feedbacks.length > 0
      ? [
          ["Name", "Date", "Rating", "Feedback"],
          ...feedbacks.map((f) => [f.name ?? "", fmtDate(f.date), f.rating, f.comment ?? ""]),
        ]
      : [["No feedback received for this course."]]
  const wsFeedback = xlsx.utils.aoa_to_sheet(feedbackRows)
  wsFeedback["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 8 }, { wch: 50 }]
  xlsx.utils.book_append_sheet(wb, wsFeedback, "Feedback")

  const buf: Uint8Array = xlsx.write(wb, { type: "buffer", bookType: "xlsx" })
  const safeName = course.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()

  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}-report.xlsx"`,
    },
  })
}
