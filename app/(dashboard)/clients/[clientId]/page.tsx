import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LeadCard from "./LeadCard";
import EmbedSettings from "./EmbedSettings";

type Props = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function ClientWorkspacePage({ params }: Props) {
  const { clientId } = await params;

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

  // THE ACTUAL ACCESS CHECK: a client-role user can only ever view
  // their own client_id. If they edit the URL to another client's
  // UUID, this blocks it with a 404 rather than leaking that the
  // client exists at all. Operators/specialists pass through freely.
  const isOperator = profile?.role === "operator" || profile?.role === "specialist";
  const isOwnClient = profile?.client_id === clientId;

  if (!isOperator && !isOwnClient) {
    notFound();
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("client_id", clientId)
    .order("last_message_at", { ascending: false });

  if (clientError || !client) {
    notFound();
  }

  const statusCounts = {
    New: leads?.filter((l) => l.status === "New").length || 0,
    Qualified: leads?.filter((l) => l.status === "Qualified").length || 0,
    Hot: leads?.filter((l) => l.status === "Hot").length || 0,
    "Callback Requested":
      leads?.filter((l) => l.status === "Callback Requested").length || 0,
    Booked: leads?.filter((l) => l.status === "Booked").length || 0,
  };

  return (
    <div className="p-8">
      <div className="border-b border-white/10 pb-6">
        <p className="text-sm font-medium text-cyan-300">
          {isOperator ? "Operator view" : "Your dashboard"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
          {client.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          {client.industry || "Service business"} in {client.location || "Unknown location"}
        </p>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">New</p>
          <p className="mt-2 text-3xl font-semibold">{statusCounts.New}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Qualified</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">
            {statusCounts.Qualified}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Hot</p>
          <p className="mt-2 text-3xl font-semibold text-orange-400">
            {statusCounts.Hot}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Callback Requested</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300">
            {statusCounts["Callback Requested"]}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Booked</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-400">
            {statusCounts.Booked}
          </p>
        </div>
      </section>

      {/* Embed settings are operator-only — a client business shouldn't
          be able to change their own domain allowlist or see the raw
          embed snippet/secret unsupervised. */}
      {isOperator && (
        <div className="mt-8">
          <EmbedSettings
            clientId={client.id}
            initialAllowedDomains={client.allowed_domains}
          />
        </div>
      )}

      <section className="mt-8 rounded-lg border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold">Leads</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sorted by most recent activity.
            {isOperator && " Click a status to update it manually."}
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {leads && leads.length > 0 ? (
            leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} readOnly={!isOperator} />
            ))
          ) : (
            <p className="p-5 text-sm text-slate-400">No leads captured yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
