import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isOperator = profile?.role === "operator" || profile?.role === "specialist";
    if (!isOperator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId } = await params;
    const body = await request.json();
    const { allowedDomains, customKnowledge, ownerAlertEmail } = body;

    // Only update fields that were actually sent
    const updateFields: Record<string, string | null> = {};
    if (allowedDomains !== undefined) updateFields.allowed_domains = allowedDomains;
    if (customKnowledge !== undefined) updateFields.custom_knowledge = customKnowledge;
    if (ownerAlertEmail !== undefined) updateFields.owner_alert_email = ownerAlertEmail;

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update(updateFields)
      .eq("id", clientId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch {
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}