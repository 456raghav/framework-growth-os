const leads = [
  {
    name: "Sarah Mitchell",
    service: "Kitchen renovation",
    budget: "$20,000",
    timeline: "Next month",
    status: "Hot",
  },
  {
    name: "James Carter",
    service: "Bathroom remodel",
    budget: "$8,000",
    timeline: "2-3 months",
    status: "Warm",
  },
  {
    name: "Alicia Brown",
    service: "Basement finishing",
    budget: "$15,000",
    timeline: "This quarter",
    status: "Hot",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-300">
              Framework Growth OS
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              AI lead system for service businesses
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Capture, qualify, book, follow up, and manage leads from one
              connected dashboard.
            </p>
          </div>

          <button className="w-fit rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
            Add Client
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">New leads</p>
            <p className="mt-2 text-3xl font-semibold">18</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Booked calls</p>
            <p className="mt-2 text-3xl font-semibold">7</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Hot leads</p>
            <p className="mt-2 text-3xl font-semibold">5</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Pipeline value</p>
            <p className="mt-2 text-3xl font-semibold">$43k</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-lg font-semibold">Qualified leads</h2>
              <p className="mt-1 text-sm text-slate-400">
                These leads were captured and qualified by the AI assistant.
              </p>
            </div>

            <div className="divide-y divide-white/10">
              {leads.map((lead) => (
                <div
                  key={lead.name}
                  className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-sm text-slate-400">{lead.service}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Budget</p>
                    <p className="font-medium">{lead.budget}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Timeline</p>
                    <p className="font-medium">{lead.timeline}</p>
                  </div>

                  <span className="h-fit rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-300">
                    {lead.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">AI assistant flow</h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-md bg-slate-900 p-4">
                <p className="text-sm text-slate-400">1. Answers questions</p>
                <p className="mt-1 text-sm">
                  Uses the client&apos;s services, FAQs, pricing, and website
                  content.
                </p>
              </div>

              <div className="rounded-md bg-slate-900 p-4">
                <p className="text-sm text-slate-400">2. Qualifies the lead</p>
                <p className="mt-1 text-sm">
                  Collects budget, timeline, location, and service needed.
                </p>
              </div>

              <div className="rounded-md bg-slate-900 p-4">
                <p className="text-sm text-slate-400">3. Books appointment</p>
                <p className="mt-1 text-sm">
                  Sends the visitor to a consultation or discovery call.
                </p>
              </div>

              <div className="rounded-md bg-slate-900 p-4">
                <p className="text-sm text-slate-400">4. Follows up</p>
                <p className="mt-1 text-sm">
                  Reminds leads automatically if they do not respond.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}