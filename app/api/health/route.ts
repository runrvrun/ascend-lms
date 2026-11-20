import { prisma } from "@/app/lib/prisma";

// Liveness/readiness probe for the server watchdog (scripts/watchdog.sh) and the
// deploy workflow. Unauthenticated on purpose and returns no data beyond "ok".
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "db_unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
