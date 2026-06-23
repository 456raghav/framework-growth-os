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
    <div className="p-4 md:p-8">
      <div className="border-b border-white/10 pb-4 md:pb-6">
        <p className="text-sm font-medium text-cyan-300">
          {isOperator ? "Operator view" : "Your dashboard"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-5xl">
          {client.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300 md:mt-3 md:text-base">
          {client.industry || "Service business"} in{" "}
          {client.location || "Unknown location"}
        </p>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-5 md:gap-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400 md:text-sm">New</p>
          <p className="mt-1 text-2xl font-semibold md:mt-2 md:text-3xl">
            {statusCounts.New}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400 md:text-sm">Qualified</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-300 md:mt-2 md:text-3xl">
            {statusCounts.Qualified}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400 md:text-sm">Hot</p>
          <p className="mt-1 text-2xl font-semibold text-orange-400 md:mt-2 md:text-3xl">
            {statusCounts.Hot}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400 md:text-sm">Callback</p>
          <p className="mt-1 text-2xl font-semibold text-amber-300 md:mt-2 md:text-3xl">
            {statusCounts["Callback Requested"]}
          </p>
        </div>
        <div className="col-span-2 rounded-lg border border-white/10 bg-white/5 p-4 md:col-span-1">
          <p className="text-xs text-slate-400 md:text-sm">Booked</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400 md:mt-2 md:text-3xl">
            {statusCounts.Booked}
          </p>
        </div>
      </section>

      {isOperator && (
        <div className="mt-6 md:mt-8">
          <EmbedSettings
            clientId={client.id}
            initialAllowedDomains={client.allowed_domains}
            initialCustomKnowledge={client.custom_knowledge}
            initialOwnerAlertEmail={client.owner_alert_email}
          />
        </div>
      )}

      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 md:mt-8">
        <div className="border-b border-white/10 p-4 md:p-5">
          <h2 className="text-lg font-semibold">Leads</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sorted by most recent activity.
            {isOperator && " Tap a status to update it manually."}
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {leads && leads.length > 0 ? (
            leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} readOnly={!isOperator} />
            ))
          ) : (
            <p className="p-4 text-sm text-slate-400 md:p-5">
              No leads captured yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}