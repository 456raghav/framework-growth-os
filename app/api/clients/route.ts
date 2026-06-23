import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { crawlWebsite } from "@/lib/crawler";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, industry, location, website, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, industry, location, website, services, faqs, calendarLink, customKnowledge } = body;

    if (!name) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .insert({
        name,
        industry,
        location,
        website,
        services,
        faqs,
        calendar_link: calendarLink,
        custom_knowledge: customKnowledge || null,
      })
      .select()
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: clientError?.message || "Failed to create client" },
        { status: 500 }
      );
    }

    let crawlStatus = {
      started: false,
      pagesFound: 0,
      pagesCrawled: 0,
      errors: [] as string[],
    };

    if (website) {
      try {
        console.log(`[Crawl] Starting for client ${client.id}: ${website}`);
        const crawlResult = await crawlWebsite(website);

        if (crawlResult.pages.length > 0) {
          const knowledgePages = crawlResult.pages.map((page) => ({
            client_id: client.id,
            page_url: page.url,
            page_title: page.title,
            content: page.content,
          }));

          const { error: insertError } = await supabaseAdmin
            .from("knowledge_pages")
            .insert(knowledgePages);

          if (insertError) {
            console.error("[Crawl] Insert error:", insertError);
          }

          console.log(`[Crawl] Stored ${knowledgePages.length} pages for ${client.name}`);
        }

        crawlStatus = {
          started: true,
          pagesFound: crawlResult.pagesFound,
          pagesCrawled: crawlResult.pagesCrawled,
          errors: crawlResult.errors,
        };
      } catch (crawlError) {
        console.error("[Crawl] Failed:", crawlError);
        crawlStatus = {
          started: true,
          pagesFound: 0,
          pagesCrawled: 0,
          errors: [`Crawl failed: ${crawlError}`],
        };
      }
    }

    return NextResponse.json({ client, crawlStatus, success: true });
  } catch (error) {
    console.error("[Clients POST] Error:", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}