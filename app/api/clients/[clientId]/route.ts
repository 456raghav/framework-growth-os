import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await request.json();
    const { allowedDomains } = body;

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update({ allowed_domains: allowedDomains })
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
