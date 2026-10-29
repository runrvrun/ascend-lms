// Storage for learner-uploaded assignment files (disk or Vercel Blob, see fileStorage.ts).
// Shared by the upload server action, the download route, and the monthly purge
// script — so this module must not import the app's prisma singleton.
import path from "path"
import { randomUUID } from "crypto"
import { loadFile, removeFile, storageLocation, storeFile } from "./fileStorage"

// Shown by the purge script
export const UPLOAD_DIR = storageLocation("assignments")

export const MAX_ASSIGNMENT_FILE_BYTES = 20 * 1024 * 1024
export const ASSIGNMENT_FILE_RETENTION_MONTHS = 6

// Extension → Content-Type served on download. Anything not listed is rejected.
const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
}

export const ALLOWED_ASSIGNMENT_EXTENSIONS = Object.keys(MIME_TYPES)

// fileKey is always `<uuid><ext>`; anything else is refused so a key can never escape UPLOAD_DIR.
const FILE_KEY_RE = /^[0-9a-f-]{36}\.[a-z]+$/

function checkKey(fileKey: string) {
  if (!FILE_KEY_RE.test(fileKey)) throw new Error("Invalid file key")
  return fileKey
}

export function validateAssignmentFile(file: File): string | null {
  if (file.size === 0) return "The file is empty."
  if (file.size > MAX_ASSIGNMENT_FILE_BYTES) return "The file is larger than 20 MB."
  const ext = path.extname(file.name).toLowerCase()
  if (!MIME_TYPES[ext]) return `File type not allowed. Allowed: ${ALLOWED_ASSIGNMENT_EXTENSIONS.join(", ")}`
  return null
}

export async function saveAssignmentFile(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase()
  const fileKey = `${randomUUID()}${ext}`
  await storeFile("assignments", checkKey(fileKey), Buffer.from(await file.arrayBuffer()), MIME_TYPES[ext] ?? "application/octet-stream")
  return fileKey
}

export async function readAssignmentFile(fileKey: string) {
  return {
    data: await loadFile("assignments", checkKey(fileKey)),
    contentType: MIME_TYPES[path.extname(fileKey)] ?? "application/octet-stream",
  }
}

// Missing files are treated as already deleted.
export async function deleteAssignmentFile(fileKey: string) {
  await removeFile("assignments", checkKey(fileKey))
}
