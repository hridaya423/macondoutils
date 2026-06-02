import { NextResponse } from "next/server";
import {
  eventsBatchSchema,
  getAndUpdateLastSeq,
  isKVConfigured,
  rateLimits,
  recordEventBatch,
  storeLastSeq,
  verifyTelemetryToken,
} from "@/lib/telemetry";

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

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request) {
  if (!isKVConfigured()) {
    return jsonError(503, "kv_unconfigured", "Telemetry storage not configured");
  }

  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonError(401, "missing_token", "Authorization Bearer token required");
  }
  const token = match[1].trim();
  const claims = await verifyTelemetryToken(token);
  if (!claims) {
    return jsonError(401, "invalid_token", "Token is invalid or expired");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }

  const parsed = eventsBatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_body", parsed.error.message);
  }

  if (parsed.data.install_id !== claims.install_id) {
    return jsonError(403, "install_mismatch", "Token does not match install_id");
  }

  const ip = getClientIp(request);
  const [ipLimit, installLimit] = await Promise.all([
    rateLimits.eventsPerIp(ip || "unknown"),
    rateLimits.eventsPerInstall(parsed.data.install_id),
  ]);
  if (!ipLimit.allowed || !installLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        scope: !installLimit.allowed ? "install" : "ip",
        resetInSeconds: installLimit.resetInSeconds,
      },
      { status: 429 },
    );
  }

  const seqResult = await getAndUpdateLastSeq(parsed.data.install_id, parsed.data.seq);
  if (seqResult === "replayed") {
    return NextResponse.json({ ok: true, dedup: "replayed", accepted: 0, rejected: 0 });
  }
  if (seqResult === "out_of_order") {
    return jsonError(409, "out_of_order", "Batch sequence must be strictly increasing");
  }

  try {
    const result = await recordEventBatch({
      installId: parsed.data.install_id,
      events: parsed.data.events,
      enabledCategories: parsed.data.categories,
      browser: parsed.data.browser,
    });
    try {
      await storeLastSeq(parsed.data.install_id, parsed.data.seq);
    } catch (err) {
      console.warn("[telemetry] Failed to persist last seq after ingest:", err);
    }
    return NextResponse.json({
      ok: true,
      accepted: result.accepted,
      rejected: result.rejected,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    return jsonError(500, "ingest_failed", message);
  }
}
