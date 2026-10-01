// Disk storage for learner-uploaded assignment files. Shared by the upload
// server action, the download route, and the monthly purge script — so this
// module must not import the app's prisma singleton.
import path from "path"
import { randomUUID } from "crypto"
import { mkdir, writeFile, unlink, readFile } from "fs/promises"

// Override with UPLOAD_DIR in production to keep uploads outside the git checkout.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"), "assignments")

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

function filePath(fileKey: string) {
  if (!FILE_KEY_RE.test(fileKey)) throw new Error("Invalid file key")
  return path.join(UPLOAD_DIR, fileKey)
}

export function validateAssignmentFile(file: File): string | null {
  if (file.size === 0) return "The file is empty."
  if (file.size > MAX_ASSIGNMENT_FILE_BYTES) return "The file is larger than 20 MB."
  const ext = path.extname(file.name).toLowerCase()
  if (!MIME_TYPES[ext]) return `File type not allowed. Allowed: ${ALLOWED_ASSIGNMENT_EXTENSIONS.join(", ")}`
  return null
}

export async function saveAssignmentFile(file: File): Promise<string> {
  const fileKey = `${randomUUID()}${path.extname(file.name).toLowerCase()}`
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(filePath(fileKey), Buffer.from(await file.arrayBuffer()))
  return fileKey
}

export async function readAssignmentFile(fileKey: string) {
  return {
    data: await readFile(filePath(fileKey)),
    contentType: MIME_TYPES[path.extname(fileKey)] ?? "application/octet-stream",
  }
}

// Missing files are treated as already deleted.
export async function deleteAssignmentFile(fileKey: string) {
  try {
    await unlink(filePath(fileKey))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
}
