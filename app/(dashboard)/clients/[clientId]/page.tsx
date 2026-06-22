"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CrawlStatus = {
  started: boolean;
  pagesFound: number;
  pagesCrawled: number;
  errors: string[];
};

export default function NewClientPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus | null>(null);
  const [saveError, setSaveError] = useState("");

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [services, setServices] = useState("");
  const [faqs, setFaqs] = useState("");
  const [calendarLink, setCalendarLink] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setCrawlStatus(null);

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        industry,
        location,
        website,
        services,
        faqs,
        calendarLink,
      }),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setSaveError(data.error || "Something went wrong while saving the client.");
      return;
    }

    // Show crawl results before redirecting so operator knows
    // what got crawled and what failed
    if (data.crawlStatus) {
      setCrawlStatus(data.crawlStatus);

      // If crawl had errors or missed pages, stay on page so operator
      // can see the details. They can navigate away manually.
      // If crawl was clean, auto-redirect after 3 seconds.
      const hasIssues =
        data.crawlStatus.errors.length > 0 ||
        (data.crawlStatus.started && data.crawlStatus.pagesCrawled === 0);

      if (!hasIssues) {
        setTimeout(() => router.push("/"), 3000);
      }
    } else {
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold md:text-4xl">Add a new client</h1>
        <p className="mt-2 text-sm text-slate-300 md:mt-3 md:text-base">
          This information becomes the business brain for the AI assistant.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-lg border border-white/10 bg-white/5 p-4 md:mt-8 md:space-y-5 md:p-5"
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business name *"
            className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industry"
            className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Service location"
            className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <div>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Website URL"
              className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              We&apos;ll crawl this website and build the AI&apos;s knowledge base after you save.
            </p>
          </div>
          <textarea
            value={services}
            onChange={(e) => setServices(e.target.value)}
            placeholder="Services offered"
            rows={4}
            className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <textarea
            value={faqs}
            onChange={(e) => setFaqs(e.target.value)}
            placeholder="FAQs"
            rows={4}
            className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <input
            value={calendarLink}
            onChange={(e) => setCalendarLink(e.target.value)}
            placeholder="Calendar booking link"
            className="w-full rounded-md bg-slate-900 p-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />

          {saveError && (
            <p className="text-sm text-red-400">✗ {saveError}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "Saving and crawling website..." : "Save Client"}
          </button>
        </form>

        {/* Crawl results — shown after save */}
        {crawlStatus && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-200">
              Website crawl results
            </p>

            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-xs text-slate-400">Pages found</p>
                <p className="text-lg font-semibold">{crawlStatus.pagesFound}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Pages crawled</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {crawlStatus.pagesCrawled}
                </p>
              </div>
              {crawlStatus.errors.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400">Errors</p>
                  <p className="text-lg font-semibold text-red-400">
                    {crawlStatus.errors.length}
                  </p>
                </div>
              )}
            </div>

            {crawlStatus.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-red-400 mb-1">
                  Pages that failed to crawl:
                </p>
                <ul className="space-y-1">
                  {crawlStatus.errors.map((err, i) => (
                    <li key={i} className="text-xs text-slate-400 break-all">
                      • {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {crawlStatus.pagesCrawled === 0 && crawlStatus.started && (
              <p className="mt-3 text-xs text-amber-400">
                ⚠ No pages were crawled successfully. The AI will have no website
                knowledge. Check the URL and try adding the client again.
              </p>
            )}

            {crawlStatus.pagesCrawled > 0 && crawlStatus.errors.length === 0 && (
              <p className="mt-3 text-xs text-emerald-400">
                ✓ All pages crawled successfully. Redirecting...
              </p>
            )}

            {crawlStatus.pagesCrawled > 0 && crawlStatus.errors.length > 0 && (
              <p className="mt-3 text-xs text-amber-400">
                ⚠ Some pages failed. The AI has partial website knowledge.
                You can still proceed — just note the gaps above.
              </p>
            )}

            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-slate-700 px-4 py-2 text-xs font-semibold"
            >
              Go to dashboard →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}