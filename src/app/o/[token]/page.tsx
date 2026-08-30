import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DraftSite } from "@/components/builder/site/draft-site";
import {
  getPublicOutreachPreviewByToken,
  recordOutreachPreviewEvent,
} from "@/data/outreach";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SiteForge outreach preview",
  robots: {
    index: false,
    follow: false,
  },
};

type OutreachPreviewPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function OutreachPreviewPage({
  params,
  searchParams,
}: OutreachPreviewPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const preview = await getPublicOutreachPreviewByToken(token);
  if (!preview) notFound();

  const requestHeaders = await headers();
  await recordOutreachPreviewEvent({
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
      path: `/o/${token}${query.page ? `?page=${query.page}` : ""}`,
    },
  });

  return (
    <DraftSite
      spec={preview.spec}
      pageId={query.page ?? "home"}
      basePath={`/o/${token}`}
      outreachTrackingToken={token}
    />
  );
}
