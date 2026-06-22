import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  // Client-role users have no use for an "all clients" overview —
  // send them straight to their own workspace.
  if (profile?.role === "client" && profile.client_id) {
    redirect(`/clients/${profile.client_id}`);
  }

  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name, industry, location, created_at")
    .order("created_at", { ascending: false });

  // Lead counts per client, for an at-a-glance overview — this is the
  // start of what becomes the Phase 3 operator console.
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("client_id, status");

  const leadCountByClient = (leads || []).reduce<Record<string, number>>(
    (acc, lead) => {
      acc[lead.client_id] = (acc[lead.client_id] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">All Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          + Add Client
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients && clients.length > 0 ? (
          clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="rounded-lg border border-white/10 bg-white/5 p-5 hover:border-cyan-400/40 transition-colors"
            >
              <p className="text-lg font-semibold">{client.name}</p>
              <p className="mt-1 text-sm text-slate-400">
                {client.industry || "Service business"}
              </p>
              <p className="mt-3 text-sm text-cyan-300">
                {leadCountByClient[client.id] || 0} leads
              </p>
            </Link>
          ))
        ) : (
          <p className="text-slate-400">No clients yet.</p>
        )}
      </div>
    </div>
  );
}
