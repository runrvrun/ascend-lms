// Browser-side image compression for course content uploads (client components only).
//
// Sizing: the lesson column is ~800 CSS px wide on a 1440 px laptop (minus the app
// sidebar and the contents list) and ~1250 px on a 1920 px monitor; on phones it's the
// full ~360–430 px screen. Laptops and phones are mostly 2–3× pixel density, so 1600 px
// wide stays sharp on a retina laptop (800 × 2) and on phones (430 × 3 ≈ 1290). Height
// isn't capped tightly so tall infographics keep readable text.
//
// Quality: WebP at 0.82 is visually indistinguishable from the original for photos and
// keeps screenshot text crisp; a typical photo lands around 150–400 KB.
export const IMAGE_MAX_WIDTH = 1600
export const IMAGE_MAX_HEIGHT = 8000
export const IMAGE_QUALITY = 0.82
// Raw files larger than this are refused before decoding (phone photos are ~3–12 MB).
export const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const IMAGE_ACCEPT = ACCEPTED_TYPES.join(",")

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("Only JPEG, PNG, WebP and GIF images are supported.")
  if (file.size > MAX_RAW_IMAGE_BYTES) throw new Error("The image is larger than 25 MB.")

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, IMAGE_MAX_WIDTH / bitmap.width, IMAGE_MAX_HEIGHT / bitmap.height)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  // GIFs keep their animation, which a canvas would drop: upload as-is unless oversized.
  if (file.type === "image/gif" && scale === 1) {
    bitmap.close()
    return { blob: file, width, height }
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let blob = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY)
  // Older Safari can't encode WebP and silently returns PNG: use JPEG on a white
  // background instead (JPEG has no transparency).
  if (!blob || blob.type !== "image/webp") {
    ctx.globalCompositeOperation = "destination-over"
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY)
  }
  if (!blob) throw new Error("This browser couldn't process the image.")

  // Already-optimised images can come out larger; keep the original then.
  if (scale === 1 && file.size <= blob.size && file.type !== "image/gif") return { blob: file, width, height }
  return { blob, width, height }
}
