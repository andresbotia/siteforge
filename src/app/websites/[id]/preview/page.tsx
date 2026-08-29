import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftSite } from "@/components/builder/site/draft-site";
import { getWebsiteById } from "@/data/websites";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { id } = await params;
  const site = await getWebsiteById(id);
  return { title: site ? `${site.businessName} draft preview` : "Draft preview" };
}

export default async function WebsitePreviewPage({ params, searchParams }: PreviewPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const site = await getWebsiteById(id);
  if (!site) notFound();
  if (!site.spec) {
    return (
      <div className="p-8 text-sm text-muted">
        This website record has no structured spec to render.
      </div>
    );
  }

  return (
    <DraftSite
      spec={site.spec}
      pageId={query.page ?? "home"}
      basePath={`/websites/${site.id}/preview`}
    />
  );
}
