import { notFound } from "next/navigation"
import { canManagePathway, getSessionUser } from "../../../lib/permissions"

// Admins manage every pathway; owners only the ones they own.
export default async function ManagePathwayLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || !(await canManagePathway(user, id))) notFound()
  return children
}
