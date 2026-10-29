// Disk storage for images uploaded into course content (IMAGE content, and the
// optional image on LINK content). Images are compressed in the browser first
// (app/lib/compressImage.ts); this module only validates and stores them.
// Like assignmentFiles.ts it must not import the app's prisma singleton.
import path from "path"
import { randomUUID } from "crypto"
import { mkdir, writeFile, readFile, unlink } from "fs/promises"

// Same UPLOAD_DIR base as assignment files (set in production to live outside the checkout).
export const CONTENT_IMAGE_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"), "content-images")

// After browser compression images are typically 100–500 KB; this only stops abuse.
export const MAX_CONTENT_IMAGE_BYTES = 5 * 1024 * 1024

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
}

// imageKey is always `<uuid><ext>`; anything else is refused so a key can never escape the directory.
const IMAGE_KEY_RE = /^[0-9a-f-]{36}\.(webp|jpg|png|gif)$/

export function isContentImageKey(key: string) {
  return IMAGE_KEY_RE.test(key)
}

// Detect the format from the file's magic bytes rather than trusting the name or MIME type.
function sniffExtension(data: Buffer): string | null {
  if (data.length < 12) return null
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return ".jpg"
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png"
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return ".webp"
  if (data.subarray(0, 4).toString("ascii") === "GIF8") return ".gif"
  return null
}

export async function saveContentImage(data: Buffer): Promise<{ key: string } | { error: string }> {
  if (data.length === 0) return { error: "The image is empty." }
  if (data.length > MAX_CONTENT_IMAGE_BYTES) return { error: "The image is larger than 5 MB after compression." }
  const ext = sniffExtension(data)
  if (!ext) return { error: "Only JPEG, PNG, WebP and GIF images are supported." }
  const key = `${randomUUID()}${ext}`
  await mkdir(CONTENT_IMAGE_DIR, { recursive: true })
  await writeFile(path.join(CONTENT_IMAGE_DIR, key), data)
  return { key }
}

export async function readContentImage(key: string) {
  if (!isContentImageKey(key)) throw new Error("Invalid image key")
  return {
    data: await readFile(path.join(CONTENT_IMAGE_DIR, key)),
    contentType: MIME_TYPES[path.extname(key)],
  }
}

// Callers must first check no content still uses the key (duplicated courses share files).
export async function deleteContentImage(key: string) {
  if (!isContentImageKey(key)) return
  await unlink(path.join(CONTENT_IMAGE_DIR, key)).catch((err) => {
    if (err?.code !== "ENOENT") console.error("[content-images] failed to delete", key, err)
  })
}
