import { prisma } from "./prisma"
import { isDeadlineLocked } from "./pathwayDeadline"

// Approved enrollments in a pathway whose learner is an active user and hasn't recorded
// any progress in it yet (no lesson done, no test taken, no course completed). Self-enrolled
// learners are left out (they never got an enrollment email to resend), and so are
// enrollments locked past their deadline, since those learners can no longer start.
export async function notStartedEnrollments(pathwayId: string) {
  const enrollments = await prisma.pathwayEnrollment.findMany({
    where: {
      pathwayId,
      status: "APPROVED",
      type: { not: "SELF_ENROLL" },
      user: {
        deletedAt: null,
        status: "ACTIVE",
        contentProgresses: { none: { pathwayId } },
        testProgresses: { none: { pathwayId } },
        courseProgress: { none: { pathwayId } },
      },
    },
    select: {
      type: true,
      deadline: true,
      cohort: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  })
  return enrollments.filter((e) => e.user.email && !isDeadlineLocked(e.deadline))
}
