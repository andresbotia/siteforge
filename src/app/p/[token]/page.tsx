import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DraftSite } from "@/components/builder/site/draft-site";
import {
  getPublicPreviewExternalTarget,
  getPublicPreviewByToken,
  recordPreviewEvent,
} from "@/data/previews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SiteForge prospect preview",
  robots: {
    index: false,
    follow: false,
  },
};

type PublicPreviewPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function PublicPreviewPage({
  params,
  searchParams,
}: PublicPreviewPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const preview = await getPublicPreviewByToken(token);
  if (!preview) notFound();

  const requestHeaders = await headers();
  await recordPreviewEvent({
    token,
    eventType: "preview_viewed",
    request: {
      method: "GET",
      userAgent: requestHeaders.get("user-agent"),
      ip:
        requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        requestHeaders.get("x-real-ip"),
      acceptLanguage: requestHeaders.get("accept-language"),
      country: requestHeaders.get("x-vercel-ip-country"),
      region: requestHeaders.get("x-vercel-ip-country-region"),
      city: requestHeaders.get("x-vercel-ip-city"),
      referrer: requestHeaders.get("referer"),
      path: `/p/${token}${query.page ? `?page=${query.page}` : ""}`,
    },
  });

  const externalTarget = getPublicPreviewExternalTarget(preview.site);
  if (preview.site.externalGeneratedSite) {
    if (externalTarget) {
      redirect(externalTarget);
    }
    notFound();
  }

  return (
    <DraftSite
      spec={preview.site.spec}
      pageId={query.page ?? "home"}
      basePath={`/p/${token}`}
      trackingToken={token}
    />
  );
}
