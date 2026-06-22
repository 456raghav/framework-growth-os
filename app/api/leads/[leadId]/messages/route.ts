import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    // Auth check — only logged-in users can read transcripts
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { leadId } = await params;

    // Get the lead to find its conversation_id and client_id
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("conversation_id, client_id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Role check — client-role users can only see their own client's leads
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .single();

    const isOperator =
      profile?.role === "operator" || profile?.role === "specialist";
    const isOwnClient = profile?.client_id === lead.client_id;

    if (!isOperator && !isOwnClient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all messages for this conversation in chronological order
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", lead.conversation_id)
      .eq("client_id", lead.client_id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}