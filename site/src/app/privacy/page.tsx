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
        <p className="mt-4 text-sm text-[#8A6E59]">Last updated: May 27, 2026</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-[#5B4638]">
          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Overview</h2>
            <p className="mt-3">
              Macondo Utils is a browser extension that adds quality-of-life improvements to the Macondo website.
              This extension is designed to keep data use minimal.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">What Data The Extension Accesses</h2>
            <p className="mt-3">
              Macondo Utils reads information already visible on <code>macondo.hackclub.com</code> in order to show
              features like improved estimates, labels, streak details, goals, and onboarding tips.
            </p>
            <p className="mt-3">
              The extension may also store your extension preferences locally in your browser, such as display
              settings, onboarding progress, and saved goal items.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">What Data Is Not Collected</h2>
            <p className="mt-3">Macondo Utils does not collect, sell, rent, or share your personal data with advertisers or data brokers.</p>
            <p className="mt-3">Macondo Utils does not use third-party analytics, ad trackers, or hidden background profiling.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Where Data Is Stored</h2>
            <p className="mt-3">
              Extension preferences and feature state are stored locally in your browser using browser storage and
              local page storage. This data stays on your device unless the underlying browser syncs it as part of
              your own browser account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Permissions</h2>
            <p className="mt-3">
              Macondo Utils currently requests limited browser permissions only as needed to run on the Macondo site
              and support its features.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Third-Party Services</h2>
            <p className="mt-3">
              The extension runs on top of the Macondo website and may use data already provided by that site during
              normal use. This policy covers Macondo Utils itself, not the privacy practices of Macondo or any other
              third-party website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Changes</h2>
            <p className="mt-3">
              This policy may be updated over time to reflect new features or compliance needs. Material updates will
              be reflected on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2D1B11]">Contact</h2>
            <p className="mt-3">
              For questions about this privacy policy, contact the project maintainer through the GitHub repository:
              {" "}
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
