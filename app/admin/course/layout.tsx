import { requireAdminPage } from "../../lib/permissions"

// Admin-only: the parent /admin layout also lets pathway owners in for /admin/pathway.
export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  return children
}
