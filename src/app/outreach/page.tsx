import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { OutreachStatusBadge } from "@/components/shared/status-badge";
import { mockOutreach } from "@/data";
import { getLeadById } from "@/data/mock-leads";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Outreach",
};

export default function OutreachPage() {
  const drafts = mockOutreach.filter((item) => item.status === "draft").length;
  const awaiting = mockOutreach.filter(
    (item) => item.status === "awaiting_approval",
  ).length;
  const sent = mockOutreach.filter((item) =>
    ["sent", "replied", "interested", "declined", "unsubscribed"].includes(
      item.status,
    ),
  ).length;
  const replies = mockOutreach.filter(
    (item) => item.status === "replied" || item.status === "interested",
  ).length;
  const interested = mockOutreach.filter(
    (item) => item.status === "interested",
  ).length;

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Fictional recipients only. Sending is not implemented and no mailbox is connected."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Drafts" value={String(drafts)} />
        <MetricCard label="Awaiting Approval" value={String(awaiting)} />
        <MetricCard label="Sent" value={String(sent)} />
        <MetricCard label="Replies" value={String(replies)} />
        <MetricCard label="Interested" value={String(interested)} />
      </div>

      <DataTable>
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Recipient</Th>
            <Th>Status</Th>
            <Th>Sent</Th>
            <Th>Opened</Th>
            <Th>Clicked</Th>
            <Th>Replied</Th>
          </tr>
        </THead>
        <tbody>
          {mockOutreach.map((item) => {
            const lead = getLeadById(item.leadId);
            return (
              <tr key={item.id} className="hover:bg-surface-hover/70">
                <Td>
                  {lead ? (
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {lead.businessName}
                    </Link>
                  ) : (
                    item.leadId
                  )}
                </Td>
                <Td className="text-muted">{item.recipient}</Td>
                <Td>
                  <OutreachStatusBadge status={item.status} />
                </Td>
                <Td className="text-muted whitespace-nowrap">
                  {item.sentAt ? formatDate(item.sentAt) : "—"}
                </Td>
                <Td className="text-muted whitespace-nowrap">
                  {item.openedAt ? formatDate(item.openedAt) : "—"}
                </Td>
                <Td className="text-muted whitespace-nowrap">
                  {item.clickedAt ? formatDate(item.clickedAt) : "—"}
                </Td>
                <Td className="text-muted whitespace-nowrap">
                  {item.repliedAt ? formatDate(item.repliedAt) : "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </>
  );
}
