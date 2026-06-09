import { NextResponse } from "next/server";
import { getStatsSnapshot, isKVConfigured, rateLimits } from "@/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "";
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimits.statsPerIp(ip || "unknown");
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", resetInSeconds: limit.resetInSeconds },
      { status: 429 },
    );
  }

  if (!isKVConfigured()) {
    return NextResponse.json({
      ok: true,
      kvConfigured: false,
      stats: {
        activeUsers24h: 0,
        activeUsers7d: 0,
        activeUsers30d: 0,
        activeUsersDaily: [],
        categoryUsage: [],
        projectLevelMedian: 0,
        projectStreakMedian: 0,
        projectLevels: [],
        projectStreaks: [],
        topGoals: [],
        topShop: [],
        themes: [],
        browsers: [],
        generatedAt: Date.now(),
      },
    });
  }

  try {
    const stats = await getStatsSnapshot();
    return NextResponse.json(
      { ok: true, kvConfigured: true, stats },
      { headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "stats_failed";
    return NextResponse.json(
      { ok: false, code: "stats_failed", message },
      { status: 500 },
    );
  }
}
