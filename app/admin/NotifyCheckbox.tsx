"use client"

// "Notify" option on the admin enroll/assign modals: unchecked adds people to the
// pathway silently (no in-app notification, no assignment email).
export function NotifyCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>
        Notify by email and in-app notification
        {!checked && <span className="block text-xs text-amber-600">They&apos;ll be added silently, with no assignment email or notification.</span>}
      </span>
    </label>
  )
}
