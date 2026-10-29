import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { isContentImageKey, readContentImage } from "../../../lib/contentImages"

// Serves an image uploaded into course content. Course material is visible to any
// signed-in user, so this only requires a session. Keys are random and never reused,
// so the response can be cached for good.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

  const { key } = await params
  if (!isContentImageKey(key)) return new NextResponse("Not found", { status: 404 })

  let image
  try {
    image = await readContentImage(key)
  } catch {
    return new NextResponse("Image not found on server", { status: 404 })
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
