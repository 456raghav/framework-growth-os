import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function ClientsPage() {
  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p>Error loading clients: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-300">
              Framework Growth OS
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              Clients
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Manage every business using your AI lead system from one place.
            </p>
          </div>

          <Link
            href="/clients/new"
            className="w-fit rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Add Client
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {clients?.map((client) => (
            <div
              key={client.id}
              className="rounded-lg border border-white/10 bg-white/5 p-5"
            >
              <h2 className="text-lg font-semibold">{client.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{client.industry}</p>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Location</span>
                  <span className="text-right font-medium">
                    {client.location || "Not added"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Website</span>
                  <span className="text-right font-medium">
                    {client.website || "Not added"}
                  </span>
                </div>
              </div>

              <Link
                href={`/clients/${client.id}`}
                className="mt-6 block w-full rounded-md border border-white/10 px-4 py-2 text-center text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                Open Workspace
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}