import { Session } from "next-auth"
import { prisma } from "../lib/prisma"
import { DashboardSidebar } from "./DashboardSidebar"

function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0

  // Normalise each completedAt to a UTC calendar-day timestamp (midnight UTC)
  const daySet = new Set(
    dates.map((d) => {
      const dd = new Date(d)
      dd.setUTCHours(0, 0, 0, 0)
      return dd.getTime()
    })
  )

  const sorted = Array.from(daySet).sort((a, b) => b - a) // newest first

  const todayMs = (() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    return d.getTime()
  })()
  const yesterdayMs = todayMs - 86_400_000

  // Streak is broken if last activity was more than 1 day ago
  if (sorted[0] < yesterdayMs) return 0

  // Count consecutive days going back from the most recent active day
  let streak = 0
  let expected = sorted[0]
  for (const day of sorted) {
    if (day === expected) {
      streak++
      expected -= 86_400_000
    } else {
      break
    }
  }
  return streak
}

export async function SidebarWithStats({ session }: { session: Session | null }) {
  const userId = (session?.user as any)?.id as string | undefined

  const [progressDates, pointsAgg, unreadCount] = userId
    ? await Promise.all([
        prisma.contentProgress.findMany({
          where: { userId },
          select: { completedAt: true },
        }),
        prisma.userPoint.aggregate({
          where: { userId },
          _sum: { points: true },
        }),
        prisma.notification.count({
          where: { userId, read: false },
        }),
      ])
    : [[], { _sum: { points: null } }, 0]

  const streak = computeStreak(progressDates.map((r) => r.completedAt))
  const totalPoints = pointsAgg._sum.points ?? 0

  return <DashboardSidebar session={session} streak={streak} totalPoints={totalPoints} unreadNotifications={unreadCount} />
}
