import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { geocodeAddress } from "@/lib/geocode";
import { createClient } from "@/lib/supabase/server";

// One-time utility: geocode a client's shop address and save coordinates.
// Operator-only. Not for repeated/public use.
export async function POST(request: Request) {
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

  const { clientId, address } = await request.json();

  if (!clientId || !address) {
    return NextResponse.json({ error: "clientId and address required" }, { status: 400 });
  }

  const coords = await geocodeAddress(address);

  if (!coords) {
    return NextResponse.json({ error: "Could not geocode address" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("clients")
    .update({ shop_latitude: coords.lat, shop_longitude: coords.lng })
    .eq("id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, coords });
}