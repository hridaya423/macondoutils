import { getKV } from "./kv";
const HOUR_SECONDS = 60 * 60;

export interface RateLimitConfig {
  max: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

function bucketKey(scope: string, identifier: string, windowSeconds: number): string {
  return `mu:rl:${scope}:${identifier}:${windowSeconds}`;
}

async function check(
  scope: string,
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (!identifier) {
    return { allowed: true, remaining: config.max, resetInSeconds: config.windowSeconds };
  }
  const kv = getKV();
  const key = bucketKey(scope, identifier, config.windowSeconds);
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, config.windowSeconds);
  }
  const remaining = Math.max(0, config.max - count);
  return {
    allowed: count <= config.max,
    remaining,
    resetInSeconds: config.windowSeconds,
  };
}

export const rateLimits = {
  attestPerInstall: (installId: string) =>
    check("attest", installId, { max: 12, windowSeconds: HOUR_SECONDS }),
  attestPerIp: (ip: string) =>
    check("attest-ip", ip, { max: 30, windowSeconds: HOUR_SECONDS }),
  eventsPerInstall: (installId: string) =>
    check("events", installId, { max: 600, windowSeconds: 60 }),
  eventsPerIp: (ip: string) =>
    check("events-ip", ip, { max: 600, windowSeconds: 60 }),
  statsPerIp: (ip: string) =>
    check("stats-ip", ip, { max: 240, windowSeconds: 60 }),
};
