import { NextResponse } from "next/server";
import { getEmailConfig } from "@/lib/email/config";
import { parseResendWebhookEvent, verifyResendWebhookSignature } from "@/lib/email/webhook";
import { asRecord } from "@/lib/json";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json, OutreachEventRow, OutreachRow } from "@/types/database";

export async function POST(request: Request) {
  const payload = await request.text();
  const config = getEmailConfig();
  if (!verifyResendWebhookSignature({ payload, headers: request.headers, secret: config.webhookSecret })) {
    return new NextResponse("Invalid webhook", { status: 400 });
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(payload) as unknown;
  } catch {
    return NextResponse.json({ received: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseResendWebhookEvent(parsedPayload);
  if (!event || !event.id) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const client = createServerSupabaseClient();
  if (!client) return NextResponse.json({ received: true, stored: false }, { status: 202 });
  if (!event.emailId) return NextResponse.json({ received: true, stored: false }, { status: 202 });

  const { data: outreach } = await client
    .from("outreach")
    .select("*")
    .eq("provider_message_id", event.emailId)
    .maybeSingle();
  if (!outreach) return NextResponse.json({ received: true, stored: false }, { status: 202 });

  const { data: events } = await client
    .from("outreach_events")
    .select("*")
    .eq("outreach_id", outreach.id);
  if (hasProviderEvent(events ?? [], event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await client.from("outreach_events").insert({
    outreach_id: outreach.id,
    event_type: event.type,
    occurred_at: event.createdAt ?? new Date().toISOString(),
    payload: {
      provider: "resend",
      provider_event_id: event.id,
      provider_message_id: event.emailId,
      recipient_email: event.to,
      raw: event.raw as Json,
    },
  });

  const nextStatus = statusFromEvent(event.type, outreach);
  if (nextStatus) {
    await client
      .from("outreach")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", outreach.id);
  }

  return NextResponse.json({ received: true, stored: true });
}

function hasProviderEvent(events: OutreachEventRow[], eventId: string): boolean {
  return events.some((event) => asRecord(event.payload).provider_event_id === eventId);
}

function statusFromEvent(
  type: string,
  outreach: Pick<OutreachRow, "status">,
): OutreachRow["status"] | null {
  if (type === "email.bounced" || type === "email.complained" || type === "email.suppressed") {
    return "failed";
  }
  if (type === "email.delivered" && outreach.status === "sent") return "sent";
  return null;
}
