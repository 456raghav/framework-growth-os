import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractDomain, isDomainAllowed } from "@/lib/domainValidation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, allowed_domains")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    return NextResponse.json(
      { allowed: false, reason: "Client not found" },
      { status: 404 }
    );
  }

  // PRIMARY CHECK: parentOrigin, passed explicitly by embed.js via query
  // param. This is necessary because the Referer header on THIS request
  // only ever reports the widget page's own URL (since the widget page's
  // own JS is what's making this fetch) — it cannot see what page embedded
  // the widget one level up in the iframe chain. embed.js runs directly
  // in the client's real page, so it knows its true origin with certainty.
  const { searchParams } = new URL(request.url);
  const parentOriginParam = searchParams.get("parentOrigin");

  // FALLBACK: Referer header, for the case where the widget is opened
  // directly (not via embed.js) — e.g. your original full-page testing flow.
  const referrer = request.headers.get("referer");

  const requestDomain = parentOriginParam
    ? extractDomain(parentOriginParam)
    : extractDomain(referrer);

  const allowed = isDomainAllowed(requestDomain, client.allowed_domains);

  if (!allowed) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "This widget is not authorized to run on this domain.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    allowed: true,
    clientName: client.name,
  });
}