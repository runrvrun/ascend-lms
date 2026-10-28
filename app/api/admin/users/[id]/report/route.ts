import { NextResponse } from "next/server"
import * as xlsx from "xlsx"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../auth/[...nextauth]/route"
import { getUserReport } from "../../../../../lib/userReport"

function fmtDate(d: string | null) {
  return d ? d.slice(0, 10) : ""
}

function fmtDateTime(d: string | null) {
  return d ? `${d.slice(0, 10)} ${d.slice(11, 16)} UTC` : ""
}

function formatEnum(val: string) {
  if (val === "NA") return "N/A"
  return val.replace(/_/g, " ").replace(/\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
}

function sheet(wb: xlsx.WorkBook, name: string, rows: (string | number)[][], widths: number[]) {
  const ws = xlsx.utils.aoa_to_sheet(rows)
  ws["!cols"] = widths.map((wch) => ({ wch }))
  xlsx.utils.book_append_sheet(wb, ws, name)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const roles = ((session?.user as any)?.roles as string[]) ?? []
  if (!session?.user || !roles.includes("ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const report = await getUserReport(id)
  if (!report) {
    return new NextResponse("User not found", { status: 404 })
  }

  const { user, activity, summary, flags } = report
  const wb = xlsx.utils.book_new()

  // ── Summary ──────────────────────────────────────────────────────────────
  sheet(
    wb,
    "Summary",
    [
      ["User Progress Report", user.name ?? user.email ?? ""],
      ["Generated", fmtDateTime(report.generatedAt)],
      [],
      ["PROFILE"],
      ["Email", user.email ?? ""],
      ["Division", user.division],
      ["Title", formatEnum(user.title)],
      ["Office", user.office ?? ""],
      ["Manager(s)", user.managers.join(", ")],
      ["Roles", user.roles.map(formatEnum).join(", ")],
      ["Account Status", user.deactivatedAt ? `Deactivated (${fmtDate(user.deactivatedAt)})` : "Active"],
      ["Account Created", fmtDate(user.accountCreatedAt)],
      [],
      ["ACTIVITY"],
      ["Last Sign-in", fmtDateTime(user.lastLoginAt) || "Not recorded"],
      ["Last Active", fmtDateTime(user.lastActiveAt) || "Not recorded"],
      ["Last Learning Activity", fmtDate(activity.lastLearningActivityAt) || "None"],
      ["Active Learning Days (all time)", activity.activeLearningDays],
      ["Active Learning Days (last 30 days)", activity.activeDaysLast30],
      ["Current Streak (days)", activity.currentStreak],
      ["Longest Streak (days)", activity.longestStreak],
      ["Total Points", activity.totalPoints],
      ["Discussion Comments Posted", activity.commentsPosted],
      ["Course Feedback Given", activity.feedbackGiven],
      [],
      ["PATHWAYS"],
      ["Enrolled", summary.pathwaysEnrolled],
      ["Completed", summary.pathwaysCompleted],
      ["In Progress", summary.pathwaysInProgress],
      ["Not Started", summary.pathwaysNotStarted],
      ["Pending Approval", summary.pathwaysPending],
      [],
      ["ASSIGNED PATHWAYS (by admin, manager or cohort)"],
      ["Total Assigned", summary.assigned.total],
      ["Completed On Time (or no deadline)", summary.assigned.completedOnTime],
      ["Completed Late", summary.assigned.completedLate],
      ["Overdue", summary.assigned.overdue],
      ["Still Open (before deadline)", summary.assigned.open],
      [
        "All Assigned Completed On Time?",
        summary.assigned.total === 0
          ? "No assigned pathways"
          : summary.assigned.completedOnTime === summary.assigned.total
          ? "Yes"
          : "No",
      ],
      [],
      ["COURSES & TESTS"],
      ["Courses Completed", summary.coursesCompleted],
      ["Courses In Progress", summary.coursesInProgress],
      ["Courses Not Started", summary.coursesNotStarted],
      ["Tests Passed", summary.testsPassed],
      ["Tests Failed", summary.testsFailed],
      ["Average Test Score (%)", summary.averageTestScore ?? ""],
      [],
      ["GROWTH PLAN"],
      ["Items", summary.growthPlan.total],
      ["Completed", summary.growthPlan.completed],
      ["Confirmed by Manager", summary.growthPlan.confirmed],
      ["Awaiting Confirmation", summary.growthPlan.awaitingConfirmation],
      [],
      ["ATTENTION NEEDED"],
      ...(flags.length
        ? flags.map((f) => [f.level === "critical" ? "Critical" : f.level === "warning" ? "Warning" : "Info", f.message])
        : [["—", "Nothing flagged"]]),
    ],
    [36, 70]
  )

  // ── Pathways ─────────────────────────────────────────────────────────────
  sheet(
    wb,
    "Pathways",
    report.pathways.length
      ? [
          ["Pathway", "Enrolled Via", "Status", "Enrolled On", "Deadline", "Completed On", "Timeliness", "Courses Completed", "Courses Total", "Progress (%)"],
          ...report.pathways.map((p) => [
            p.name, p.enrolledVia, p.status, fmtDate(p.enrolledAt), fmtDate(p.deadline), fmtDate(p.completedAt),
            p.timeliness ?? "", p.coursesCompleted, p.coursesTotal, p.progressPct,
          ]),
        ]
      : [["No pathway enrollments."]],
    [36, 24, 16, 13, 13, 14, 13, 10, 10, 10]
  )

  // ── Courses ──────────────────────────────────────────────────────────────
  sheet(
    wb,
    "Courses",
    report.courses.length
      ? [
          ["Pathway", "Course", "Status", "Completed On", "Content Done", "Content Total", "Tests Passed", "Tests Total", "Assignment"],
          ...report.courses.map((c) => [
            c.pathwayName, c.courseName, c.status, fmtDate(c.completedAt), c.contentsCompleted, c.contentsTotal,
            c.testsPassed, c.testsTotal, c.assignment,
          ]),
        ]
      : [["No courses in enrolled pathways."]],
    [32, 36, 13, 14, 12, 12, 12, 11, 17]
  )

  // ── Tests ────────────────────────────────────────────────────────────────
  sheet(
    wb,
    "Tests",
    report.tests.length
      ? [
          ["Pathway", "Course", "Test", "Status", "Score (%)", "Taken On"],
          ...report.tests.map((t) => [t.pathwayName, t.courseName, t.testTitle, t.status, t.score ?? "", fmtDate(t.takenAt)]),
        ]
      : [["No tests in enrolled pathways."]],
    [32, 32, 32, 14, 10, 13]
  )

  // ── Growth Plan ──────────────────────────────────────────────────────────
  sheet(
    wb,
    "Growth Plan",
    report.growthPlans.length
      ? [
          ["Item", "Pathway", "Created On", "Completed On", "Confirmed On", "Status"],
          ...report.growthPlans.map((g) => [
            g.title, g.pathwayName ?? "", fmtDate(g.createdAt), fmtDate(g.completedAt), fmtDate(g.confirmedAt),
            g.confirmedAt ? "Confirmed" : g.completedAt ? "Awaiting confirmation" : "Open",
          ]),
        ]
      : [["No growth plan items."]],
    [44, 32, 13, 14, 14, 22]
  )

  // ── Points ───────────────────────────────────────────────────────────────
  sheet(
    wb,
    "Points",
    report.points.length
      ? [["Date", "Points", "Source"], ...report.points.map((p) => [fmtDate(p.date), p.points, p.source])]
      : [["No points earned yet."]],
    [13, 10, 20]
  )

  const buf: Uint8Array = xlsx.write(wb, { type: "buffer", bookType: "xlsx" })
  const safeName = (user.name ?? user.email ?? "user").replace(/[^a-z0-9]/gi, "-").toLowerCase()
  const date = report.generatedAt.slice(0, 10)

  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}-progress-report-${date}.xlsx"`,
    },
  })
}
