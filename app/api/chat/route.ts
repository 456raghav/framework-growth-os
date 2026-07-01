import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import { extractDomain, isDomainAllowed } from "@/lib/domainValidation";
import { sendBookingConfirmation, sendEmergencyAlert } from "@/lib/email";
import { geocodeZip } from "@/lib/geocode";
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
        zipCode: { type: SchemaType.STRING, nullable: true, description: "Visitor's zip/postal code or area, if mentioned. Used only to plot approximate service location on a map — never store exact street address here." },
        serviceNeeded: { type: SchemaType.STRING, nullable: true, description: "What service/product they need" },
        budget: { type: SchemaType.STRING, nullable: true, description: "Budget mentioned, if any" },
        timeline: { type: SchemaType.STRING, nullable: true, description: "When they need the PROJECT done, if mentioned (e.g. '2 weeks', 'by next month')" },
        wantsToBook: { type: SchemaType.BOOLEAN, description: "True if visitor has agreed to or asked for a call/booking" },
        preferredCallTime: { type: SchemaType.STRING, nullable: true, description: "When the visitor is FREE for a phone/video call, in their own words." },
        isEmergency: { type: SchemaType.BOOLEAN, description: "True if the visitor's situation is urgent or an emergency." },
        emergencyDescription: { type: SchemaType.STRING, nullable: true, description: "One sentence describing the emergency. Only set when isEmergency is true." },
      },
      required: ["wantsToBook", "isEmergency"],
    },
  },
  required: ["reply", "extracted"],
};

async function generateWithRetry(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  prompt: string,
  maxRetries = 3
): Promise<{ reply: string; extracted: ExtractedLeadData & { zipCode?: string | null; isEmergency: boolean; emergencyDescription?: string } }> {
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

    const customKnowledgeSection = client.custom_knowledge
      ? `\nCUSTOM BUSINESS KNOWLEDGE (highest priority — always use this over website content if there is a conflict):\n${client.custom_knowledge}\n`
      : "";

    const calendarLinkSection = client.calendar_link
      ? `\nCALENDAR BOOKING LINK: ${client.calendar_link}\nWhen the visitor agrees to a call or asks how to book, share this link directly in your message. Say something like: "You can pick a time that works for you here: ${client.calendar_link}" — send the full URL so they can click it.`
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
Zip/Area: ${existingLead.zip_code || "unknown"}
Service: ${existingLead.service_needed || "unknown"}
Budget: ${existingLead.budget || "unknown"}
Project Timeline: ${existingLead.timeline || "unknown"}
Preferred Call Time: ${existingLead.preferred_call_time || "unknown"}

Do not re-ask for information already known above. Only ask for what's still missing.`
      : "Nothing known about this visitor yet.";

    const bookingStep = client.calendar_link
      ? `Step 6: Share the booking link — say "You can pick a time here: ${client.calendar_link}" and confirm you've sent it. The visitor self-books directly.`
      : `Step 6: Confirm — "Got it [name], we'll call you at [contact] on [their stated time]. Talk soon!"`;

    const prompt = `
You are an AI sales assistant for ${client.name}.

Your ONLY job is:
1. Understand what the visitor needs
2. Qualify them (budget, project timeline, service needed)
3. Collect their contact details (name, email or phone) and their zip code or area (for service dispatch)
4. Once they agree to a call, send them the booking link or ask when they're free

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
${calendarLinkSection}
${knownFields}

EMERGENCY DETECTION
Some visitors have urgent situations that need immediate attention. If the visitor describes an emergency:
- Acknowledge the urgency immediately: "That sounds urgent — let me get someone to you ASAP."
- Still collect their contact info quickly so the owner can call them back immediately
- Set isEmergency to true and write a one-sentence emergencyDescription

CONVERSATION RULES
- Write like WhatsApp. Short. Conversational. Human.
- One question per message maximum.
- Never use bullet lists unless the visitor asks.
- Never greet more than once.
- Keep replies under 60 words whenever possible.
- Never invent information not in the knowledge base.
- "Timeline" (project deadline) and "preferred call time" (when they're free to talk) are DIFFERENT things.

LEAD QUALIFICATION FLOW
Step 1: Understand their need
Step 2: Qualify (budget, project timeline)
Step 3: Confirm interest — ask if they'd like a quick call
Step 4: Collect name AND (email or phone) AND their zip code/area (for service dispatch)
Step 5: Ask what day/time works best (skip if calendar link — send link instead)
${bookingStep}

CRITICAL RULE: NEVER ask for a preferred call time before you have BOTH their name and a way to contact them. Check "ALREADY KNOWN ABOUT THIS VISITOR" before deciding what to ask next.

Once name + contact + service + zip are known and booking is handled, confirm and stop asking questions.

CONVERSATION HISTORY
${conversationHistory}

VISITOR'S MESSAGE
${message}

Respond with JSON matching the schema. Extract any new information the visitor just shared.
Set wantsToBook to true ONLY if they've explicitly agreed to a call/booking.
Set isEmergency to true ONLY if the situation is genuinely urgent.
`;

    let reply: string;
    let extracted: ExtractedLeadData & { zipCode?: string | null; isEmergency: boolean; emergencyDescription?: string } = {
      wantsToBook: false,
      isEmergency: false,
    };

    try {
      const result = await generateWithRetry(model, prompt);
      reply = result.reply;
      extracted = result.extracted;
    } catch (error: unknown) {
      console.error("=== GEMINI CALL FAILED ===", error);

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

    const mergedData: ExtractedLeadData & { zipCode?: string | null } = {
      name: extracted.name || existingLead?.name || null,
      email: extracted.email || existingLead?.email || null,
      phone: extracted.phone || existingLead?.phone || null,
      zipCode: extracted.zipCode || existingLead?.zip_code || null,
      serviceNeeded: extracted.serviceNeeded || existingLead?.service_needed || null,
      budget: extracted.budget || existingLead?.budget || null,
      timeline: extracted.timeline || existingLead?.timeline || null,
      wantsToBook: extracted.wantsToBook || false,
      preferredCallTime: extracted.preferredCallTime || existingLead?.preferred_call_time || null,
    };

    const isEmergency = extracted.isEmergency || existingLead?.is_emergency || false;
    const emergencyDescription = extracted.emergencyDescription || existingLead?.emergency_description || null;

    const hasAnyData =
      mergedData.name || mergedData.email || mergedData.phone || mergedData.serviceNeeded;

    if (hasAnyData) {
      const newStatus = determineLeadStatus(
        mergedData,
        (existingLead?.status as LeadStatus) || null
      );
      const score = calculateQualificationScore(mergedData);

      // Geocode zip only if it's new or changed — avoid repeat API calls
      let latitude = existingLead?.latitude || null;
      let longitude = existingLead?.longitude || null;
      const zipChanged = mergedData.zipCode && mergedData.zipCode !== existingLead?.zip_code;

      if (zipChanged) {
        const coords = await geocodeZip(mergedData.zipCode!);
        if (coords) {
          latitude = coords.lat;
          longitude = coords.lng;
        }
      }

      const { error: upsertError } = await supabaseAdmin
        .from("leads")
        .upsert(
          {
            client_id: clientId,
            conversation_id: conversationId,
            name: mergedData.name,
            email: mergedData.email,
            phone: mergedData.phone,
            zip_code: mergedData.zipCode,
            service_needed: mergedData.serviceNeeded,
            budget: mergedData.budget,
            timeline: mergedData.timeline,
            preferred_call_time: mergedData.preferredCallTime,
            status: newStatus,
            qualification_score: score,
            last_message_at: new Date().toISOString(),
            is_emergency: isEmergency,
            emergency_description: emergencyDescription,
            latitude,
            longitude,
          },
          { onConflict: "client_id,conversation_id" }
        );

      if (upsertError) {
        console.error("=== LEAD UPSERT FAILED ===", upsertError);
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
            console.error("=== BOOKING CONFIRMATION EMAIL FAILED ===", emailResult.error);
          }
        }

        const wasAlreadyEmergency = existingLead?.is_emergency === true;

        if (isEmergency && !wasAlreadyEmergency && client.owner_alert_email) {
          const alertResult = await sendEmergencyAlert({
            toEmail: client.owner_alert_email,
            businessName: client.name,
            emergencyDescription: emergencyDescription || "Emergency situation detected",
            visitorName: mergedData.name ?? null,
            visitorPhone: mergedData.phone ?? null,
            visitorEmail: mergedData.email ?? null,
            serviceNeeded: mergedData.serviceNeeded ?? null,
          });

          if (!alertResult.success) {
            console.error("=== EMERGENCY ALERT FAILED ===", alertResult.error);
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