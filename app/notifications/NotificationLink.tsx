"use client"

import { useTransition } from "react"
import { markNotificationRead } from "../discussions/actions"

export function NotificationLink({
  notificationId,
  href,
  className,
  children,
}: {
  notificationId: string
  href: string
  className?: string
  children: React.ReactNode
}) {
  const [, startTransition] = useTransition()

  function handleClick() {
    startTransition(() => markNotificationRead(notificationId))
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
