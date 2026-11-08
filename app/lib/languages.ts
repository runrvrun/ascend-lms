import type { Language } from "@prisma/client"

// Display order and labels for Course.language. Client-safe (type-only import).
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "EN", label: "English" },
  { value: "JP", label: "Japanese" },
]

export function isLanguage(v: unknown): v is Language {
  return LANGUAGES.some((l) => l.value === v)
}
