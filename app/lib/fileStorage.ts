// Where uploaded files live. Production keeps them on the server's disk under
// UPLOAD_DIR; on Vercel (staging) the disk doesn't persist, so when the project has a
// connected Blob store (Vercel sets BLOB_READ_WRITE_TOKEN) files go to Vercel Blob instead.
// Same code in both environments: the backend is picked from the environment.
// Callers validate keys before calling; files are always served through the app's own
// routes (with their access checks), never by a public URL.
// Must not import the app's prisma singleton (used by scripts too).
import path from "path"
import { mkdir, writeFile, readFile, unlink } from "fs/promises"
import { put, get, del } from "@vercel/blob"

export type StorageBucket = "assignments" | "content-images"

// Blob stores are created as private or public; set BLOB_ACCESS=public for a public store.
const BLOB_ACCESS = process.env.BLOB_ACCESS === "public" ? "public" : "private"

export function usingBlobStorage() {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

// Override with UPLOAD_DIR in production to keep uploads outside the git checkout.
export function diskDir(bucket: StorageBucket) {
  return path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"), bucket)
}

export function storageLocation(bucket: StorageBucket) {
  return usingBlobStorage() ? `Vercel Blob (${bucket}/)` : diskDir(bucket)
}

export async function storeFile(bucket: StorageBucket, key: string, data: Buffer, contentType: string) {
  if (usingBlobStorage()) {
    await put(`${bucket}/${key}`, data, { access: BLOB_ACCESS, contentType, addRandomSuffix: false })
    return
  }
  await mkdir(diskDir(bucket), { recursive: true })
  await writeFile(path.join(diskDir(bucket), key), data)
}

// Throws if the file doesn't exist.
export async function loadFile(bucket: StorageBucket, key: string): Promise<Buffer> {
  if (usingBlobStorage()) {
    const result = await get(`${bucket}/${key}`, { access: BLOB_ACCESS })
    if (!result || result.statusCode !== 200) throw new Error(`File not found: ${bucket}/${key}`)
    return Buffer.from(await new Response(result.stream).arrayBuffer())
  }
  return readFile(path.join(diskDir(bucket), key))
}

// Missing files are treated as already deleted.
export async function removeFile(bucket: StorageBucket, key: string) {
  if (usingBlobStorage()) {
    await del(`${bucket}/${key}`)
    return
  }
  try {
    await unlink(path.join(diskDir(bucket), key))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
}
