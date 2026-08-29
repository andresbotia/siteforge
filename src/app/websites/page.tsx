import type { Metadata } from "next";
import Link from "next/link";
import { listWebsites } from "@/data/websites";
import { Button } from "@/components/shared/button";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { WebsiteStatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Websites",
};

export default async function WebsitesPage() {
  const websites = await listWebsites();

  return (
    <>
      <PageHeader
        title="Websites"
        description="Generated website records from Supabase. Preview hosts are fictional and are not deployed."
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
          {websites.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="border-t border-border-subtle px-3 py-6 text-sm text-muted"
              >
                No websites yet.
              </td>
            </tr>
          ) : null}
          {websites.map((site) => (
            <tr key={site.id} className="hover:bg-surface-hover/70">
              <Td>
                <Link
                  href={`/leads/${site.leadId}`}
                  className="font-medium hover:text-accent"
                >
                  {site.businessName}
                </Link>
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
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
