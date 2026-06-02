import type { Metadata } from "next";
import { getStatsSnapshot, isKVConfigured } from "@/lib/telemetry";
import StatsContent from "@/components/stats-content";

export const metadata: Metadata = {
  title: "Live Usage Stats | Macondo Utils",
  description: "Opt-in, anonymous usage stats from the Macondo Utils extension.",
};

export const revalidate = 30;

export default async function StatsPage() {
  const stats = isKVConfigured() ? await getStatsSnapshot() : null;

  return (
    <main className="min-h-screen bg-[#FFF9F2] text-[#2D1B11] font-sans">
      <section className="px-6 py-16 md:px-12 md:py-24 max-w-6xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9C6B4E]">
          Macondo Utils
        </p>
        <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight">
          Live usage stats
        </h1>
        <p className="mt-3 max-w-2xl text-[#5B4638] text-base leading-7">
          Anonymous, opt-in usage data shared by people who turned on telemetry
          in the extension. Counts are powered by HyperLogLog across the last
          1, 7, and 30 days. No personal data is collected.
        </p>

        <StatsContent initialStats={stats} kvConfigured={isKVConfigured()} />
      </section>
    </main>
  );
}
