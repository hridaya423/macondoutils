"use client";

import { useEffect, useState } from "react";
import type { StatsSnapshot } from "@/lib/telemetry";

export default function LiveStatsBadge() {
  const [active7d, setActive7d] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/telemetry/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; stats?: StatsSnapshot };
        if (!cancelled && data?.ok && data.stats) {
          setActive7d(data.stats.activeUsers7d);
          setLoaded(true);
        }
      } catch {
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!loaded || active7d === null) {
    return (
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9C6B4E]">
        Opt-in usage stats
      </span>
    );
  }

  return (
    <a
      href="/stats"
      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9C6B4E] hover:text-[#2D1B11] transition-colors"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9C6B4E] opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9C6B4E]" />
      </span>
      {active7d.toLocaleString()} active this week
    </a>
  );
}
