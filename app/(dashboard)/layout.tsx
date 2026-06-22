import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's role/profile using the admin client — this read
  // happens once per page load to build the nav shell, separate from
  // the RLS-scoped reads that happen on the actual data pages.
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("role, client_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Logged in via Supabase Auth but no profile row exists yet —
    // this shouldn't happen in normal use, but fail safely rather
    // than crash.
    redirect("/login?error=no_profile");
  }

  // Operators/specialists see every client in the sidebar.
  // Client-role users see only their own single client, no switcher.
  let clientList: { id: string; name: string }[] = [];

  if (profile.role === "operator" || profile.role === "specialist") {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .order("name");
    clientList = data || [];
  } else if (profile.client_id) {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("id", profile.client_id)
      .single();
    if (data) clientList = [data];
  }

  return (
    <DashboardShell
      role={profile.role}
      fullName={profile.full_name || user.email || "User"}
      clients={clientList}
    >
      {children}
    </DashboardShell>
  );
}
