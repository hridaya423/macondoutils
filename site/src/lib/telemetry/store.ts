import { getKV, type ZSetMember } from "./kv";
import {
  eventCategoriesForType,
  type TelemetryCategory,
  type TelemetryEvent,
} from "./schemas";

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;

const KEYS = {
  hllDay: "mu:t:hll:1d",
  hllWeek: "mu:t:hll:7d",
  hllMonth: "mu:t:hll:30d",
  categories: "mu:t:categories",
  topGoals: "mu:t:top:goals",
  projectLevels: "mu:t:project:levels",
  projectStreaks: "mu:t:project:streaks",
  themes: "mu:t:themes",
  browsers: "mu:t:browsers",
  seq: (id: string) => `mu:t:seq:${id}`,
  lastSeen: (id: string) => `mu:t:last:${id}`,
};

function goalKey(goalId: string, name: string): string {
  return `${goalId}:${name}`;
}

export function parseGoalKey(combined: string): { goal_id: string; name: string } {
  const idx = combined.indexOf(":");
  if (idx < 0) return { goal_id: combined, name: combined };
  return { goal_id: combined.slice(0, idx), name: combined.slice(idx + 1) };
}

export async function recordEventBatch(params: {
  installId: string;
  events: TelemetryEvent[];
  enabledCategories: TelemetryCategory[];
  browser?: string;
}): Promise<{ accepted: number; rejected: number }> {
  const { installId, events, enabledCategories, browser } = params;
  const kv = getKV();
  const accepted: TelemetryEvent[] = [];
  let rejected = 0;

  for (const ev of events) {
    const needed = eventCategoriesForType(ev.type);
    const isAllowed = needed.some((c) => enabledCategories.includes(c));
    if (!isAllowed) {
      rejected += 1;
      continue;
    }
    accepted.push(ev);
  }

  if (accepted.length === 0) {
    return { accepted: 0, rejected };
  }

  if (browser) {
    await kv.zincrby(KEYS.browsers, 1, browser);
  }

  await Promise.all([
    kv.pfadd(KEYS.hllDay, installId),
    kv.pfadd(KEYS.hllWeek, installId),
    kv.pfadd(KEYS.hllMonth, installId),
  ]);
  await Promise.all([
    kv.expire(KEYS.hllDay, DAY_SECONDS),
    kv.expire(KEYS.hllWeek, WEEK_SECONDS),
    kv.expire(KEYS.hllMonth, 30 * DAY_SECONDS),
  ]);

  for (const ev of accepted) {
    for (const category of eventCategoriesForType(ev.type)) {
      await kv.zincrby(KEYS.categories, 1, category);
    }
    switch (ev.type) {
      case "goal_added":
      case "goal_removed":
      case "goal_qty_changed":
        await kv.zincrby(KEYS.topGoals, 1, goalKey(ev.goal_id, ev.name));
        break;
      case "shop_card_interact":
        await kv.zincrby("mu:t:top:shop", 1, goalKey(ev.item_id, ev.name));
        break;
      case "theme_preset_changed":
        await kv.zincrby(KEYS.themes, 1, ev.preset);
        break;
      case "project_metrics_snapshot":
        for (const level of ev.level_counts) {
          await kv.zincrby(KEYS.projectLevels, level.count, String(level.level));
        }
        for (const streak of ev.streak_counts) {
          await kv.zincrby(KEYS.projectStreaks, streak.count, String(streak.streak_days));
        }
        break;
      default:
        break;
    }
  }

  return { accepted: accepted.length, rejected };
}

export async function getAndUpdateLastSeq(
  installId: string,
  incoming: number,
): Promise<"accepted" | "replayed" | "out_of_order"> {
  const kv = getKV();
  const key = KEYS.seq(installId);
  const raw = await kv.get(key);
  const last = raw ? Number(raw) : 0;
  if (incoming <= last) {
    return incoming === last ? "replayed" : "out_of_order";
  }
  return "accepted";
}

export async function storeLastSeq(installId: string, incoming: number): Promise<void> {
  const kv = getKV();
  await kv.set(KEYS.seq(installId), String(incoming), { ex: 7 * DAY_SECONDS });
  await kv.set(KEYS.lastSeen(installId), String(Math.floor(Date.now() / 1000)), {
    ex: 30 * DAY_SECONDS,
  });
}

export interface StatsSnapshot {
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  categoryUsage: Array<{ category: TelemetryCategory; count: number }>;
  projectLevelMedian: number;
  projectStreakMedian: number;
  projectLevels: Array<{ level: number; count: number }>;
  projectStreaks: Array<{ streak_days: number; count: number }>;
  topGoals: Array<{ goal_id: string; name: string; count: number }>;
  topShop: Array<{ item_id: string; name: string; count: number }>;
  themes: Array<{ preset: string; count: number }>;
  browsers: Array<{ browser: string; count: number }>;
  generatedAt: number;
}

function weightedMedian(entries: ZSetMember[], valueFromMember: (member: string) => number): number {
  const sorted = entries
    .map((entry) => ({ value: valueFromMember(entry.member), count: Math.max(0, Math.round(Number(entry.score) || 0)) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.count > 0)
    .sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, entry) => sum + entry.count, 0);
  if (total <= 0) return 0;
  const leftIndex = Math.floor((total - 1) / 2);
  const rightIndex = Math.floor(total / 2);
  let seen = 0;
  let leftValue = sorted[0].value;
  let rightValue = sorted[0].value;
  for (const entry of sorted) {
    const nextSeen = seen + entry.count;
    if (seen <= leftIndex && leftIndex < nextSeen) {
      leftValue = entry.value;
    }
    if (seen <= rightIndex && rightIndex < nextSeen) {
      rightValue = entry.value;
      break;
    }
    seen = nextSeen;
  }
  return (leftValue + rightValue) / 2;
}

export async function getStatsSnapshot(): Promise<StatsSnapshot> {
  const kv = getKV();
  const [dau, wau, mau, categoryUsage, projectLevels, projectStreaks, topGoals, topShop, themes, browsers] =
    await Promise.all([
      kv.pfcount(KEYS.hllDay),
      kv.pfcount(KEYS.hllWeek),
      kv.pfcount(KEYS.hllMonth),
      kv.zrevrange(KEYS.categories, 0, -1, true),
      kv.zrevrange(KEYS.projectLevels, 0, -1, true),
      kv.zrevrange(KEYS.projectStreaks, 0, -1, true),
      kv.zrevrange(KEYS.topGoals, 0, 9, true),
      kv.zrevrange("mu:t:top:shop", 0, 9, true),
      kv.zrevrange(KEYS.themes, 0, -1, true),
      kv.zrevrange(KEYS.browsers, 0, -1, true),
    ]);

  return {
    activeUsers24h: dau,
    activeUsers7d: wau,
    activeUsers30d: mau,
    categoryUsage: categoryUsage.map((entry) => ({ category: entry.member as TelemetryCategory, count: entry.score })),
    projectLevelMedian: weightedMedian(projectLevels, (member) => Number(member)),
    projectStreakMedian: weightedMedian(projectStreaks, (member) => Number(member)),
    projectLevels: projectLevels.map((entry) => ({ level: Number(entry.member), count: entry.score })),
    projectStreaks: projectStreaks.map((entry) => ({ streak_days: Number(entry.member), count: entry.score })),
    topGoals: topGoals.map((entry) => {
      const parsed = parseGoalKey(entry.member);
      return { ...parsed, count: entry.score };
    }),
    topShop: topShop.map((entry) => {
      const parsed = parseGoalKey(entry.member);
      return { item_id: parsed.goal_id, name: parsed.name, count: entry.score };
    }),
    themes: themes.map((entry) => ({ preset: entry.member, count: entry.score })),
    browsers: browsers.map((entry) => ({ browser: entry.member, count: entry.score })),
    generatedAt: Date.now(),
  };
}

export const __KEYS = KEYS;
export const __DAY_SECONDS = DAY_SECONDS;
