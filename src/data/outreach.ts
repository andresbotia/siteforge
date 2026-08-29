import { readTable } from "@/lib/supabase/server";
import type { Outreach, OutreachStatus } from "@/types";
import type { LeadRow, OutreachEventRow, OutreachRow } from "@/types/database";

const dbStatuses = new Set<OutreachStatus>([
  "draft",
  "awaiting_approval",
  "sent",
  "replied",
  "interested",
  "declined",
  "unsubscribed",
]);

function displayStatus(
  status: string,
  events: OutreachEventRow[],
): OutreachStatus {
  if (events.some((event) => event.event_type === "unsubscribed")) {
    return "unsubscribed";
  }
  if (events.some((event) => event.event_type === "declined")) {
    return "declined";
  }
  if (events.some((event) => event.event_type === "interested")) {
    return "interested";
  }
  if (dbStatuses.has(status as OutreachStatus)) {
    return status as OutreachStatus;
  }
  return "draft";
}

export async function listOutreach(): Promise<Outreach[]> {
  const [rows, events, leads] = await Promise.all([
    readTable<OutreachRow[]>((client) =>
      client.from("outreach").select("*").order("created_at", { ascending: false }),
    ),
    readTable<OutreachEventRow[]>((client) =>
      client.from("outreach_events").select("*"),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
  ]);

  const nameById = new Map(
    (leads ?? []).map((lead) => [lead.id, lead.business_name]),
  );
  const eventsByOutreach = new Map<string, OutreachEventRow[]>();
  for (const event of events ?? []) {
    const list = eventsByOutreach.get(event.outreach_id) ?? [];
    list.push(event);
    eventsByOutreach.set(event.outreach_id, list);
  }

  return (rows ?? []).map((row) => {
    const related = eventsByOutreach.get(row.id) ?? [];
    const opened = related.find((event) => event.event_type === "opened");
    const clicked = related.find((event) => event.event_type === "clicked");
    const replied = related.find((event) => event.event_type === "replied");
    return {
      id: row.id,
      leadId: row.lead_id,
      businessName: nameById.get(row.lead_id) ?? "Unknown business",
      recipient: row.recipient_email ?? "",
      subject: row.subject ?? "",
      body: row.body ?? "",
      status: displayStatus(row.status, related),
      sentAt: row.sent_at,
      openedAt: opened?.occurred_at ?? null,
      clickedAt: clicked?.occurred_at ?? null,
      repliedAt: replied?.occurred_at ?? null,
    };
  });
}
