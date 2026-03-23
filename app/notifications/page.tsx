import type { Metadata } from "next"
export const metadata: Metadata = { title: "Notifications" }

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "../lib/prisma"
import { SidebarWithStats } from "../components/SidebarWithStats"
import { ArrowLeft, Bell, MessageCircle, CheckCircle2, XCircle, BookOpen, Users } from "lucide-react"
import { markAllNotificationsRead } from "../discussions/actions"
import { NotificationLink } from "./NotificationLink"

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/")

  const userId = (session.user as any).id as string

  const notifications = await prisma.notification.findMany({
    where: { userId },
    include: {
      comment: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      pathway: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72">
      <SidebarWithStats session={session} />

      <main className="mx-auto min-h-screen w-full max-w-2xl p-6 md:p-10">
        <a href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} />
          Back to Dashboard
        </a>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                Mark all as read
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
              <Bell size={32} className="opacity-30" />
              <p className="text-sm">No notifications yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const iconMap = {
                  COMMENT_REPLY:          { icon: <MessageCircle size={14} />, bg: "bg-blue-100",   color: "text-blue-600"  },
                  ENROLLMENT_APPROVED:    { icon: <CheckCircle2  size={14} />, bg: "bg-green-100",  color: "text-green-600" },
                  ENROLLMENT_REJECTED:    { icon: <XCircle       size={14} />, bg: "bg-red-100",    color: "text-red-600"   },
                  PATHWAY_ASSIGNED:       { icon: <BookOpen      size={14} />, bg: "bg-purple-100", color: "text-purple-600"},
                  COHORT_PATHWAY_ASSIGNED:{ icon: <Users         size={14} />, bg: "bg-amber-100",  color: "text-amber-600" },
                }
                const { icon, bg, color } = iconMap[n.type] ?? iconMap.COMMENT_REPLY
                const pathway = n.pathway

                return (
                  <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${!n.read ? "bg-blue-50/50" : ""}`}>
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
                      {icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{n.message}</p>
                      {n.type === "COMMENT_REPLY" && n.comment?.body && (
                        <p className="mt-1 line-clamp-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
                          {n.comment.body}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                        {pathway && (
                          <NotificationLink
                            notificationId={n.id}
                            href={`/pathways/${pathway.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            <BookOpen size={11} />
                            Open pathway
                          </NotificationLink>
                        )}
                      </div>
                    </div>

                    {!n.read && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
