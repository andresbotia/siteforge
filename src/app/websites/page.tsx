import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shared/button";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { WebsiteStatusBadge } from "@/components/shared/status-badge";
import { mockWebsites } from "@/data";
import { getLeadById } from "@/data/mock-leads";
import { formatDate, formatScore } from "@/lib/format";

export const metadata: Metadata = {
  title: "Websites",
};

export default function WebsitesPage() {
  return (
    <>
      <PageHeader
        title="Websites"
        description="Generated website records. Preview hosts are fictional and are not deployed."
      />
      <DataTable>
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Status</Th>
            <Th>Template</Th>
            <Th>Before Score</Th>
            <Th>After Score</Th>
            <Th>Preview</Th>
            <Th>Created</Th>
          </tr>
        </THead>
        <tbody>
          {mockWebsites.map((site) => {
            const lead = getLeadById(site.leadId);
            return (
              <tr key={site.id} className="hover:bg-surface-hover/70">
                <Td>
                  {lead ? (
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {lead.businessName}
                    </Link>
                  ) : (
                    site.leadId
                  )}
                </Td>
                <Td>
                  <WebsiteStatusBadge status={site.status} />
                </Td>
                <Td className="text-muted">{site.template}</Td>
                <Td className="tabular-nums">{site.beforeScore}</Td>
                <Td className="tabular-nums">{formatScore(site.afterScore)}</Td>
                <Td>
                  <div className="flex max-w-xs items-center gap-2">
                    <span className="truncate text-xs text-muted">
                      {site.previewUrl.replace("https://", "")}
                    </span>
                    <Button size="sm" variant="ghost" disabled>
                      Open
                    </Button>
                  </div>
                </Td>
                <Td className="text-muted whitespace-nowrap">
                  {formatDate(site.createdAt)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </>
  );
}
