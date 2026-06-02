import { z } from "zod";

export const TELEMETRY_CATEGORIES = [
  "activity",
  "goals",
  "shop",
  "projects",
  "theme",
  "errors",
] as const;

export type TelemetryCategory = (typeof TELEMETRY_CATEGORIES)[number];

export const categoryEventTypes: Record<TelemetryCategory, string[]> = {
  activity: ["session_start", "onboarding_completed"],
  goals: ["goal_added", "goal_removed", "goal_qty_changed"],
  shop: ["shop_card_interact"],
  projects: ["project_metrics_snapshot"],
  theme: ["theme_preset_changed"],
  errors: ["error_reported"],
};

const idSchema = z.string().min(1).max(120);
const nameSchema = z.string().min(1).max(200);

export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session_start"),
    path: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("goal_added"),
    goal_id: idSchema,
    name: nameSchema,
  }),
  z.object({
    type: z.literal("goal_removed"),
    goal_id: idSchema,
    name: nameSchema,
  }),
  z.object({
    type: z.literal("goal_qty_changed"),
    goal_id: idSchema,
    name: nameSchema,
    quantity: z.number().int().min(0).max(9999),
  }),
  z.object({
    type: z.literal("shop_card_interact"),
    item_id: idSchema,
    name: nameSchema,
    gold: z.number().int().min(0).max(1_000_000_000),
  }),
  z.object({
    type: z.literal("project_metrics_snapshot"),
    project_count: z.number().int().min(0).max(10_000),
    median_level: z.number().min(0).max(4),
    median_streak_days: z.number().min(0).max(100_000),
    level_counts: z.array(
      z.object({
        level: z.number().int().min(1).max(4),
        count: z.number().int().min(0).max(10_000),
      }),
    ).max(4),
    streak_counts: z.array(
      z.object({
        streak_days: z.number().int().min(0).max(100_000),
        count: z.number().int().min(0).max(10_000),
      }),
    ).max(500),
  }),
  z.object({
    type: z.literal("theme_preset_changed"),
    preset: z.enum(["default", "dark"]),
  }),
  z.object({
    type: z.literal("onboarding_completed"),
    flow_version: z.string().min(1).max(40),
  }),
  z.object({
    type: z.literal("error_reported"),
    kind: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
  }),
]);

export type TelemetryEvent = z.infer<typeof eventSchema>;

export const attestRequestSchema = z.object({
  install_id: z.string().uuid(),
});

export type AttestRequest = z.infer<typeof attestRequestSchema>;

export const eventsBatchSchema = z.object({
  install_id: z.string().uuid(),
  seq: z.number().int().min(1).max(1_000_000_000),
  categories: z
    .array(z.enum(TELEMETRY_CATEGORIES))
    .min(1)
    .max(TELEMETRY_CATEGORIES.length),
  events: z.array(eventSchema).min(1).max(50),
  browser: z.enum(["chrome", "firefox", "edge", "safari", "opera", "arc", "brave", "other"]).optional(),
});

export type EventsBatch = z.infer<typeof eventsBatchSchema>;

export function eventCategoriesForType(type: TelemetryEvent["type"]): TelemetryCategory[] {
  const out: TelemetryCategory[] = [];
  for (const cat of TELEMETRY_CATEGORIES) {
    if (categoryEventTypes[cat].includes(type)) {
      out.push(cat);
    }
  }
  return out;
}
