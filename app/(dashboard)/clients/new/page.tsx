"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClientPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [website, setWebsite] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [services, setServices] = useState("");
  const [faqs, setFaqs] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name,
        industry,
        location,
        website,
        services,
        faqs,
        calendarLink: (
          event.currentTarget.elements.namedItem(
            "calendarLink"
          ) as HTMLInputElement
        )?.value,
      }),
    });

    const data = await response.json();

    setSaving(false);

    if (!response.ok) {
      alert(data.error || "Something went wrong while saving the client.");
      return;
    }

    router.push("/clients");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-4xl font-semibold">Add a new client</h1>

        <p className="mt-3 text-slate-300">
          This information becomes the business brain for the AI assistant.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-lg border border-white/10 bg-white/5 p-5"
        >
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business name"
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <input
            name="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industry"
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <input
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Service location"
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <input
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Website URL"
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <p className="text-xs text-slate-400">
            We&apos;ll automatically crawl this website and build the AI&apos;s knowledge base after you save.
          </p>

          <textarea
            name="services"
            value={services}
            onChange={(e) => setServices(e.target.value)}
            placeholder="Services"
            rows={4}
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <textarea
            name="faqs"
            value={faqs}
            onChange={(e) => setFaqs(e.target.value)}
            placeholder="FAQs"
            rows={4}
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <input
            name="calendarLink"
            placeholder="Calendar booking link"
            className="w-full rounded-md bg-slate-900 p-3"
          />

          <button
            disabled={saving}
            className="w-full rounded-md bg-cyan-300 px-4 py-3 font-semibold text-slate-950"
          >
            {saving ? "Saving..." : "Save Client"}
          </button>
        </form>
      </section>
    </main>
  );
}
