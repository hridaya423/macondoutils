import { NextResponse } from "next/server";
import {
  attestRequestSchema,
  isKVConfigured,
  rateLimits,
  signTelemetryToken,
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }

  const parsed = attestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_body", parsed.error.message);
  }

  const ip = getClientIp(request);
  const [ipLimit, installLimit] = await Promise.all([
    rateLimits.attestPerIp(ip || "unknown"),
    rateLimits.attestPerInstall(parsed.data.install_id),
  ]);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", scope: "ip", resetInSeconds: ipLimit.resetInSeconds },
      { status: 429 },
    );
  }
  if (!installLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", scope: "install", resetInSeconds: installLimit.resetInSeconds },
      { status: 429 },
    );
  }

  if (!isKVConfigured()) {
    return jsonError(503, "kv_unconfigured", "Telemetry storage not configured");
  }

  try {
    const token = await signTelemetryToken({
      install_id: parsed.data.install_id,
    });
    return NextResponse.json({
      ok: true,
      token,
      expiresInSeconds: 60 * 60 * 24 * 30,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sign_failed";
    return jsonError(500, "sign_failed", message);
  }
}
