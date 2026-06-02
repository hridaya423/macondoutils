"use client";

import { useEffect, useMemo, useState } from "react";
import type { StatsSnapshot } from "@/lib/telemetry";

interface Props {
  initialStats: StatsSnapshot | null;
  kvConfigured: boolean;
}

const CHART_PALETTE = [
  "#C2410C",
  "#D97706",
  "#CA8A04",
  "#65A30D",
  "#059669",
  "#0D9488",
  "#0284C7",
  "#7C3AED",
  "#BE185D",
  "#6B7280",
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function prettyCategory(category: string): string {
  switch (category) {
    case "activity":
      return "Activity";
    case "goals":
      return "Goals";
    case "shop":
      return "Shop";
    case "projects":
      return "Projects";
    case "theme":
      return "Theme";
    case "errors":
      return "Errors";
    default:
      return category;
  }
}

function prettyBrowser(browser: string): string {
  switch (browser) {
    case "chrome":
      return "Chrome";
    case "firefox":
      return "Firefox";
    case "edge":
      return "Edge";
    case "safari":
      return "Safari";
    case "opera":
      return "Opera";
    case "arc":
      return "Arc";
    case "brave":
      return "Brave";
    default:
      return "Other";
  }
}

function bucketStreakDays(items: Array<{ streak_days: number; count: number }>) {
  const buckets = new Map([
    ["0", 0],
    ["1-6", 0],
    ["7-13", 0],
    ["14-29", 0],
    ["30-59", 0],
    ["60+", 0],
  ]);
  for (const item of items) {
    const days = Number(item.streak_days) || 0;
    const count = Number(item.count) || 0;
    if (days <= 0) buckets.set("0", buckets.get("0")! + count);
    else if (days < 7) buckets.set("1-6", buckets.get("1-6")! + count);
    else if (days < 14) buckets.set("7-13", buckets.get("7-13")! + count);
    else if (days < 30) buckets.set("14-29", buckets.get("14-29")! + count);
    else if (days < 60) buckets.set("30-59", buckets.get("30-59")! + count);
    else buckets.set("60+", buckets.get("60+")! + count);
  }
  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
}

function DonutChart({
  title,
  items,
  empty,
  centerLabel = "Total",
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  empty: string;
  centerLabel?: string;
}) {
  const safe = items.filter((it) => it.value > 0);
  const total = safe.reduce((sum, it) => sum + it.value, 0);
  const size = 168;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    if (total === 0) return [];
    let cumulative = 0;
    return safe.map((it, i) => {
      const fraction = it.value / total;
      const dash = fraction * circumference;
      const offset = -cumulative;
      cumulative += dash;
      return {
        ...it,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
        dash,
        offset,
        pct: fraction * 100,
      };
    });
  }, [safe, total, circumference]);

  return (
    <div className="rounded-3xl border border-[#E8D9CE] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>
      {total === 0 ? (
        <p className="mt-4 text-sm text-[#8A6E59]">{empty}</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              role="img"
              aria-label={`${title} donut chart`}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#F5EFEB"
                strokeWidth={stroke}
              />
              {segments.map((seg) => (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                  strokeDashoffset={seg.offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black tracking-tight text-[#2D1B11]">
                {formatNumber(total)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9C6B4E]">
                {centerLabel}
              </span>
            </div>
          </div>
          <ul className="flex-1 space-y-2 text-sm">
            {segments.map((seg) => (
              <li key={seg.label} className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="flex-1 truncate font-medium text-[#2D1B11]">
                  {seg.label}
                </span>
                <span className="font-semibold tabular-nums text-[#5B4638]">
                  {formatNumber(seg.value)}
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-[#8A6E59]">
                  {seg.pct.toFixed(seg.pct < 10 ? 1 : 0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BarChart({
  title,
  items,
  empty,
  maxItems,
  valueSuffix,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  empty: string;
  maxItems?: number;
  valueSuffix?: string;
}) {
  const safe = items
    .filter((it) => it.value > 0)
    .slice(0, maxItems ?? items.length);
  const max = safe.reduce((m, it) => (it.value > m ? it.value : m), 0);
  return (
    <div className="rounded-3xl border border-[#E8D9CE] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>
      {safe.length === 0 ? (
        <p className="mt-4 text-sm text-[#8A6E59]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {safe.map((it, i) => {
            const pct = max > 0 ? (it.value / max) * 100 : 0;
            const color = CHART_PALETTE[i % CHART_PALETTE.length];
            return (
              <li key={`${it.label}-${i}`}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate pr-3 font-medium text-[#2D1B11]">
                    {it.label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-[#5B4638]">
                    {formatNumber(it.value)}
                    {valueSuffix ? <span className="text-[#8A6E59]"> {valueSuffix}</span> : null}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#F5EFEB]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-[#E8D9CE] bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9C6B4E]">
        {label}
      </p>
      <p className="mt-3 text-3xl md:text-4xl font-black tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-[#8A6E59]">{hint}</p> : null}
    </div>
  );
}

export default function StatsContent({ initialStats, kvConfigured }: Props) {
  const [stats, setStats] = useState<StatsSnapshot | null>(initialStats);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!kvConfigured) return;
    let cancelled = false;
    const refresh = async () => {
      setRefreshing(true);
      try {
        const res = await fetch("/api/telemetry/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          kvConfigured: boolean;
          stats: StatsSnapshot;
        };
        if (!cancelled && data?.ok) {
          setStats(data.stats);
        }
      } catch {
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };
    const id = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kvConfigured]);

  if (!kvConfigured) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-[#E8D9CE] bg-white p-8 text-center">
        <p className="text-lg font-bold">Telemetry storage is not configured.</p>
        <p className="mt-2 text-sm text-[#5B4638]">
          Set <code className="rounded bg-[#F5EFEB] px-1.5 py-0.5">KV_REST_API_URL</code>{" "}
          and <code className="rounded bg-[#F5EFEB] px-1.5 py-0.5">KV_REST_API_TOKEN</code>{" "}
          on the Vercel project to enable stats.
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="mt-10 text-sm text-[#5B4638]">Loading stats…</p>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-[#9C6B4E]">
          {refreshing ? "Refreshing…" : "Live"}
        </p>
        <p className="text-xs text-[#8A6E59]">
          Updated {new Date(stats.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Active (24h)"
          value={formatNumber(stats.activeUsers24h)}
          hint="Unique installs that pinged in the last day"
        />
        <StatCard
          label="Active (7d)"
          value={formatNumber(stats.activeUsers7d)}
          hint="Unique installs in the last week"
        />
        <StatCard
          label="Active (30d)"
          value={formatNumber(stats.activeUsers30d)}
          hint="Unique installs in the last 30 days"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Median project level"
          value={stats.projectLevelMedian ? stats.projectLevelMedian.toFixed(1) : "0"}
          hint="Median across cached project states"
        />
        <StatCard
          label="Median streak days"
          value={stats.projectStreakMedian ? stats.projectStreakMedian.toFixed(1) : "0"}
          hint="Median across cached project states"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BarChart
          title="Project levels"
          items={stats.projectLevels.map((item) => ({
            label: `Level ${item.level}`,
            value: item.count,
          }))}
          empty="No project level data yet"
        />
        <BarChart
          title="Project streaks"
          items={bucketStreakDays(stats.projectStreaks)}
          empty="No project streak data yet"
        />
      </div>

      <DonutChart
        title="Browsers"
        items={stats.browsers.map((item) => ({
          label: prettyBrowser(item.browser),
          value: item.count,
        }))}
        empty="No browser data yet"
        centerLabel="Batches"
      />

      <DonutChart
        title="Feature usage"
        items={stats.categoryUsage.map((item) => ({
          label: prettyCategory(item.category),
          value: item.count,
        }))}
        empty="No telemetry yet — enable a few categories in the extension settings to start seeing usage."
        centerLabel="Events"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BarChart
          title="Top goal items"
          items={stats.topGoals.map((g) => ({ label: g.name, value: g.count }))}
          empty="No goal data yet — opt in to share goal usage in the extension settings."
        />
        <BarChart
          title="Top shop items"
          items={stats.topShop.map((s) => ({ label: s.name, value: s.count }))}
          empty="No shop data yet — opt in to share shop usage in the extension settings."
        />
      </div>

      <DonutChart
        title="Theme presets"
        items={stats.themes.map((t) => ({ label: t.preset, value: t.count }))}
        empty="No theme data yet"
        centerLabel="Picks"
      />
    </div>
  );
}
