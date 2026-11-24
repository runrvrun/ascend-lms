// Makes a whole table row or card open a link, without hijacking the controls inside it.
// A click counts only when it lands on the row itself: not on a button, link, form field or
// menu inside it, not inside a portal (e.g. an open Actions menu, whose React events still
// bubble up to the row), and not at the end of selecting text. Cmd/Ctrl-click opens a new tab.
const INTERACTIVE = "a, button, input, select, textarea, label, summary, [role='menu'], [role='menuitem'], [role='dialog'], [data-no-row-click]"

export function navigateFromRow(e: React.MouseEvent<HTMLElement>, href: string, push: (href: string) => void) {
  const target = e.target as HTMLElement
  if (!e.currentTarget.contains(target)) return
  if (target.closest(INTERACTIVE)) return
  if (window.getSelection()?.toString()) return
  if (e.metaKey || e.ctrlKey) window.open(href, "_blank")
  else push(href)
}
