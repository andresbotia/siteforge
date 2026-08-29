import type { Metadata } from "next";
import Link from "next/link";
import { listOutreach } from "@/data/outreach";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { OutreachStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outreach",
};

export default async function OutreachPage() {
  const outreach = await listOutreach();
  const drafts = outreach.filter((item) => item.status === "draft").length;
  const awaiting = outreach.filter(
    (item) => item.status === "awaiting_approval",
  ).length;
  const sent = outreach.filter((item) =>
    ["sent", "replied", "interested", "declined", "unsubscribed"].includes(
      item.status,
    ),
  ).length;
  const replies = outreach.filter(
    (item) => item.status === "replied" || item.status === "interested",
  ).length;
  const interested = outreach.filter(
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
          {outreach.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="border-t border-border-subtle px-3 py-6 text-sm text-muted"
              >
                No outreach yet.
              </td>
            </tr>
          ) : null}
          {outreach.map((item) => (
            <tr key={item.id} className="hover:bg-surface-hover/70">
              <Td>
                <Link
                  href={`/leads/${item.leadId}`}
                  className="font-medium hover:text-accent"
                >
                  {item.businessName}
                </Link>
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
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
