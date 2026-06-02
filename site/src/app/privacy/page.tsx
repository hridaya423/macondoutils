import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Macondo Utils",
  description: "Privacy policy for the Macondo Utils browser extension.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FFF9F2] px-6 py-16 text-[#2D1B11] md:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9C6B4E]">Macondo Utils</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-[#8A6E59]">Last updated: June 2, 2026</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-[#5B4638]">
          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Overview</h2>
            <p className="mt-3">
              Macondo Utils is a browser extension that adds quality-of-life improvements to the Macondo website.
              The extension is designed to keep data use minimal and to default to keeping your activity on your
              device.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">What Data The Extension Accesses</h2>
            <p className="mt-3">
              Macondo Utils reads information already visible on <code>macondo.hackclub.com</code> in order to show
              features like improved estimates, labels, streak details, goals, and onboarding tips.
            </p>
            <p className="mt-3">
              The extension also stores your extension preferences locally in your browser, such as display
              settings, onboarding progress, and saved goal items.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Opt-In First-Party Telemetry</h2>
            <p className="mt-3">
              Macondo Utils can send a small, anonymous stream of usage events to a first-party endpoint hosted
              alongside this website. This helps the project understand which features are used and how many
              active installs exist. <strong>Telemetry is off by default.</strong>
            </p>
            <p className="mt-3">
              When you choose to opt in, the extension prompts you to enable each category independently:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li><strong>Activity</strong> — a tiny heartbeat that lets the project count active users.</li>
              <li><strong>Goals</strong> — the names of goal items you star and how their quantities change.</li>
              <li><strong>Shop</strong> — which shop items you interact with.</li>
              <li><strong>Projects</strong> — aggregated project level and streak counts from your cached project data.</li>
              <li><strong>Theme</strong> — which theme preset you pick.</li>
              <li><strong>Errors</strong> — basic error reports only.</li>
            </ul>
            <p className="mt-3">
              Every batch is also tagged with the browser family (Chrome, Firefox, Edge, Safari, Opera, Arc,
              Brave, or Other) read from your user agent, so the project can understand which browser
              ecosystem is in use. The browser label is a coarse family string only — no full user agent,
              version, or device fingerprint is stored.
            </p>
            <p className="mt-3">
              Each event carries a randomly generated, anonymous identifier stored only in your browser. The
              identifier is not tied to your Macondo account, email, IP, or any personal data. The server
              stores a one-way hash of the identifier.
            </p>
            <p className="mt-3">
              You can change or revoke telemetry consent at any time from the extension settings panel, or by
              clearing the extension&apos;s local storage. The settings panel is the gear icon added by Macondo
              Utils on the dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">What Data Is Not Collected</h2>
            <p className="mt-3">Macondo Utils does not collect, sell, rent, or share your personal data with advertisers or data brokers.</p>
            <p className="mt-3">Macondo Utils does not use third-party analytics, ad trackers, or hidden background profiling.</p>
            <p className="mt-3">Macondo Utils never sends the contents of any Macondo page, your name, your project titles, your gold balance, or any other personal data, regardless of your telemetry settings.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Where Data Is Stored</h2>
            <p className="mt-3">
              Extension preferences and feature state are stored locally in your browser using browser storage and
              local page storage. This data stays on your device unless the underlying browser syncs it as part of
              your own browser account settings.
            </p>
            <p className="mt-3">
              When telemetry is enabled, anonymous counters are stored in a Redis-backed key-value store
              (<code>Upstash</code> via Vercel KV) on the project&apos;s Vercel deployment. Counters are aggregated
              only: no raw event log is retained.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Permissions</h2>
            <p className="mt-3">
              Macondo Utils currently requests limited browser permissions only as needed to run on the Macondo
              site and support its features. The telemetry endpoint lives on this site&apos;s domain and is only
              contacted when you opt in.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Security</h2>
            <p className="mt-3">
              Telemetry requests are authenticated with a short-lived signed token derived from your anonymous
              install identifier. Requests are rate-limited per install and per IP, and a strict event schema is
              enforced server-side to reject malformed or oversized payloads.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Third-Party Services</h2>
            <p className="mt-3">
              The extension runs on top of the Macondo website and may use data already provided by that site
              during normal use. The optional telemetry endpoint is operated by the project itself on Vercel and
              uses Upstash Redis for storage. This policy covers Macondo Utils itself, not the privacy practices
              of Macondo or any other third-party website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Changes</h2>
            <p className="mt-3">
              This policy may be updated over time to reflect new features or compliance needs. Material updates
              will be reflected on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Contact</h2>
            <p className="mt-3">
              For questions about this privacy policy, contact the project maintainer through the GitHub repository:{" "}
              <a
                href="https://github.com/hridaya423/macondoutils"
                className="font-semibold text-[#9C6B4E] underline underline-offset-4"
              >
                github.com/hridaya423/macondoutils
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
