import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import { extractDomain, isDomainAllowed } from "@/lib/domainValidation";
import { sendBookingConfirmation } from "@/lib/email";
import {
  determineLeadStatus,
  calculateQualificationScore,
  type ExtractedLeadData,
  type LeadStatus,
} from "@/lib/leadStatus";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    reply: {
      type: SchemaType.STRING,
      description: "The conversational message to send to the visitor. Under 60 words, WhatsApp style.",
    },
    extracted: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, nullable: true, description: "Visitor's name, if mentioned" },
        email: { type: SchemaType.STRING, nullable: true, description: "Visitor's email, if mentioned" },
        phone: { type: SchemaType.STRING, nullable: true, description: "Visitor's phone number, if mentioned" },
        serviceNeeded: { type: SchemaType.STRING, nullable: true, description: "What service/product they need" },
        budget: { type: SchemaType.STRING, nullable: true, description: "Budget mentioned, if any" },
        timeline: { type: SchemaType.STRING, nullable: true, description: "When they need the PROJECT done, if mentioned (e.g. '2 weeks', 'by next month')" },
        wantsToBook: { type: SchemaType.BOOLEAN, description: "True if visitor has agreed to or asked for a call/booking" },
        preferredCallTime: { type: SchemaType.STRING, nullable: true, description: "When the visitor is FREE for a phone/video call, in their own words (e.g. 'Tuesday afternoon', 'call me 3-5pm', 'anytime tomorrow'). This is different from 'timeline' — timeline is about the project deadline, this is about call availability." },
      },
      required: ["wantsToBook"],
    },
  },
  required: ["reply", "extracted"],
};

async function generateWithRetry(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  prompt: string,
  maxRetries = 3
): Promise<{ reply: string; extracted: ExtractedLeadData }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);
      return parsed;
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("quota") ||
          error.message.includes("RESOURCE_EXHAUSTED"));

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, conversationId, message, parentOrigin } = body;

    if (!clientId || !conversationId || !message) {
      return NextResponse.json(
        { error: "clientId, conversationId and message are required" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long. Please keep messages under 2000 characters." },
        { status: 400 }
      );
    }

    const rateCheck = await checkRateLimit(conversationId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          reply: "You're sending messages very quickly. Give me a moment — try again in a minute.",
          rateLimited: true,
        },
        { status: 200 }
      );
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const referrer = request.headers.get("referer");
    const requestDomain = parentOrigin
      ? extractDomain(parentOrigin)
      : extractDomain(referrer);

    if (!isDomainAllowed(requestDomain, client.allowed_domains)) {
      return NextResponse.json(
        { error: "This widget is not authorized to run on this domain." },
        { status: 403 }
      );
    }

    const { data: pages } = await supabaseAdmin
      .from("knowledge_pages")
      .select("page_title, page_url, content")
      .eq("client_id", clientId);

    const { data: previousMessages } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("client_id", clientId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: existingLead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("client_id", clientId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    const websiteKnowledge =
      pages
        ?.map(
          (page) =>
            `PAGE: ${page.page_title}\nURL: ${page.page_url}\n\n${page.content?.slice(0, 5000)}`
        )
        .join("\n\n---\n\n") || "No website knowledge available.";

    // GAP 3 — inject custom knowledge above website content.
    // Marked highest priority so it wins over crawled content on conflicts
    // (e.g. the crawled site says "call us anytime" but custom knowledge
    // says "not available Sundays" — the custom knowledge is ground truth).
    const customKnowledgeSection = client.custom_knowledge
      ? `\nCUSTOM BUSINESS KNOWLEDGE (highest priority — always use this over website content if there is a conflict):\n${client.custom_knowledge}\n`
      : "";

    const conversationHistory =
      previousMessages
        ?.reverse()
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n") || "";

    await supabaseAdmin.from("messages").insert({
      client_id: clientId,
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as never,
      },
    });

    const knownFields = existingLead
      ? `ALREADY KNOWN ABOUT THIS VISITOR:
Name: ${existingLead.name || "unknown"}
Email: ${existingLead.email || "unknown"}
Phone: ${existingLead.phone || "unknown"}
Service: ${existingLead.service_needed || "unknown"}
Budget: ${existingLead.budget || "unknown"}
Project Timeline: ${existingLead.timeline || "unknown"}
Preferred Call Time: ${existingLead.preferred_call_time || "unknown"}

Do not re-ask for information already known above. Only ask for what's still missing.`
      : "Nothing known about this visitor yet.";

    const prompt = `
You are an AI sales assistant for ${client.name}.

Your ONLY job is:
1. Understand what the visitor needs
2. Qualify them (budget, project timeline, service needed)
3. Collect their contact details (name, email or phone)
4. Once they agree to a call, ask WHEN they're free (specific day/time window) — do not just say "our team will reach out," ask them to tell you their availability in their own words

You are NOT a consultant. You do NOT give strategic advice. You ask short questions, one at a time.

BUSINESS INFORMATION
Name: ${client.name}
Industry: ${client.industry}
Location: ${client.location}
Services: ${client.services}
FAQs: ${client.faqs}

WEBSITE KNOWLEDGE
${websiteKnowledge}
${customKnowledgeSection}
${knownFields}

CONVERSATION RULES
- Write like WhatsApp. Short. Conversational. Human.
- One question per message maximum.
- Never use bullet lists unless the visitor asks.
- Never greet more than once.
- Keep replies under 60 words whenever possible.
- Never invent information not in the knowledge base.
- "Timeline" (project deadline) and "preferred call time" (when they're free to talk) are DIFFERENT things — ask about them separately, don't conflate them.

LEAD QUALIFICATION FLOW
Step 1: Understand their need
Step 2: Qualify (budget, project timeline)
Step 3: Confirm interest — ask if they'd like a quick call
Step 4: Once they agree to a call, you MUST collect their name AND (email or phone) BEFORE asking anything else. Do not skip this step even if they've already said "yes" to a call. Ask: "Great! Can I get your name and the best email or number to reach you?"
Step 5: ONLY once you have their name AND contact info, ask: "What day/time works best for you? Our team will call you then." Capture their answer exactly as they phrase it.
Step 6: Confirm — "Got it [name], we'll call you at [contact] on [their stated time]. Talk soon!"

CRITICAL RULE: NEVER ask for a preferred call time before you have BOTH their name and a way to contact them (email or phone). If the visitor says "yes" to a call but you don't have their name/contact yet, your NEXT message must ask for name + contact — not for timing. Check the "ALREADY KNOWN ABOUT THIS VISITOR" section above before deciding what to ask next; if name or contact is still "unknown" there, ask for it before anything else.

Once name + contact + service + a preferred call time are known, the conversation is complete — confirm and stop asking questions. Just answer anything else they bring up naturally.

CONVERSATION HISTORY
${conversationHistory}

VISITOR'S MESSAGE
${message}

Respond with JSON matching the schema. Extract any new information the visitor just shared.
Set wantsToBook to true ONLY if they've explicitly agreed to a call/booking or asked to book.
`;

    let reply: string;
    let extracted: ExtractedLeadData = { wantsToBook: false };

    try {
      const result = await generateWithRetry(model, prompt);
      reply = result.reply;
      extracted = result.extracted;
      console.log("=== RAW GEMINI EXTRACTION THIS TURN ===");
      console.log(JSON.stringify(extracted, null, 2));
      console.log("=== EXISTING LEAD BEFORE MERGE ===");
      console.log(JSON.stringify(existingLead, null, 2));
      console.log("=== END EXTRACTION DEBUG ===");
    } catch (error: unknown) {
      console.error("=== GEMINI CALL FAILED ===");
      console.error(error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      console.error("=== END ERROR ===");

      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("quota") ||
          error.message.includes("RESOURCE_EXHAUSTED"));

      reply = isRateLimit
        ? "I'm a little busy right now — give me 30 seconds and try again."
        : "Something went wrong on my end. Try sending your message again.";
    }

    await supabaseAdmin.from("messages").insert({
      client_id: clientId,
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
    });

    const mergedData: ExtractedLeadData = {
      name: extracted.name || existingLead?.name || null,
      email: extracted.email || existingLead?.email || null,
      phone: extracted.phone || existingLead?.phone || null,
      serviceNeeded: extracted.serviceNeeded || existingLead?.service_needed || null,
      budget: extracted.budget || existingLead?.budget || null,
      timeline: extracted.timeline || existingLead?.timeline || null,
      wantsToBook: extracted.wantsToBook || false,
      preferredCallTime: extracted.preferredCallTime || existingLead?.preferred_call_time || null,
    };

    console.log("=== MERGED DATA ABOUT TO BE SAVED ===");
    console.log(JSON.stringify(mergedData, null, 2));
    console.log("=== END MERGED DATA ===");

    const hasAnyData =
      mergedData.name || mergedData.email || mergedData.phone || mergedData.serviceNeeded;

    if (hasAnyData) {
      const newStatus = determineLeadStatus(
        mergedData,
        (existingLead?.status as LeadStatus) || null
      );
      const score = calculateQualificationScore(mergedData);

      const { error: upsertError } = await supabaseAdmin
        .from("leads")
        .upsert(
          {
            client_id: clientId,
            conversation_id: conversationId,
            name: mergedData.name,
            email: mergedData.email,
            phone: mergedData.phone,
            service_needed: mergedData.serviceNeeded,
            budget: mergedData.budget,
            timeline: mergedData.timeline,
            preferred_call_time: mergedData.preferredCallTime,
            status: newStatus,
            qualification_score: score,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "client_id,conversation_id" }
        );

      if (upsertError) {
        console.error("=== LEAD UPSERT FAILED ===");
        console.error(upsertError);
        console.error("=== END LEAD UPSERT ERROR ===");
      } else {
        const wasAlreadyBooked = existingLead?.status === "Booked";
        const isNowBooked = newStatus === "Booked";

        if (isNowBooked && !wasAlreadyBooked && mergedData.email) {
          const emailResult = await sendBookingConfirmation({
            toEmail: mergedData.email,
            leadName: mergedData.name || "",
            businessName: client.name,
            preferredCallTime: mergedData.preferredCallTime || "soon",
            serviceNeeded: mergedData.serviceNeeded || null,
          });

          if (!emailResult.success) {
            console.error("=== BOOKING CONFIRMATION EMAIL FAILED ===");
            console.error(emailResult.error);
            console.error("=== END EMAIL ERROR ===");
          } else {
            console.log(`[Email] Booking confirmation sent to ${mergedData.email}`);
          }
        }
      }
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}