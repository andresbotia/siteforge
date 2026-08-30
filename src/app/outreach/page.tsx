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
  const approved = outreach.filter((item) => item.status === "approved").length;
  const sent = outreach.filter((item) =>
    ["sent", "replied", "interested", "declined", "unsubscribed"].includes(
      item.status,
    ),
  ).length;
  const replies = outreach.filter(
    (item) => item.status === "replied" || item.status === "interested",
  ).length;

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Deterministic prospect email outreach with evidence-based drafting, approval gates, and tracked preview attribution."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Drafts" value={String(drafts)} />
        <MetricCard label="Awaiting Approval" value={String(awaiting)} />
        <MetricCard label="Approved to Send" value={String(approved)} />
        <MetricCard label="Sent" value={String(sent)} />
        <MetricCard label="Replies" value={String(replies)} />
      </div>

      <DataTable>
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Recipient</Th>
            <Th>Status</Th>
            <Th>Subject</Th>
            <Th>Sent</Th>
            <Th>Action</Th>
          </tr>
        </THead>
        <tbody>
          {outreach.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="border-t border-border-subtle px-3 py-6 text-sm text-muted"
              >
                No outreach drafts yet. Run the Sales Agent to generate drafts.
              </td>
            </tr>
          ) : null}
          {outreach.map((item) => (
            <tr key={item.id} className="hover:bg-surface-hover/70">
              <Td>
                <Link
                  href={`/outreach/${item.id}`}
                  className="font-medium hover:text-accent"
                >
                  {item.businessName}
                </Link>
              </Td>
              <Td className="text-muted">{item.recipient || "N/A"}</Td>
              <Td>
                <OutreachStatusBadge status={item.status} />
              </Td>
              <Td className="text-muted max-w-xs truncate">{item.subject || "N/A"}</Td>
              <Td className="text-muted whitespace-nowrap">
                {item.sentAt ? formatDate(item.sentAt) : "N/A"}
              </Td>
              <Td>
                <Link
                  href={`/outreach/${item.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  View Details
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
