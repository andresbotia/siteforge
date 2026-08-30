import { NextResponse, type NextRequest } from "next/server";
import { recordOutreachPreviewEvent } from "@/data/outreach";
import { recordPreviewEvent } from "@/data/previews";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const record = asRecord(body);
  const token = typeof record.token === "string" ? record.token : "";
  const outreachToken = typeof record.outreachToken === "string" ? record.outreachToken : "";
  const eventType = typeof record.eventType === "string" ? record.eventType : "";
  const path = typeof record.path === "string" ? record.path : null;
  const requestHeaders = request.headers;

  const requestFacts = {
    method: request.method,
    userAgent: requestHeaders.get("user-agent"),
    ip:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip"),
    acceptLanguage: requestHeaders.get("accept-language"),
    country: requestHeaders.get("x-vercel-ip-country"),
    region: requestHeaders.get("x-vercel-ip-country-region"),
    city: requestHeaders.get("x-vercel-ip-city"),
    referrer: requestHeaders.get("referer"),
    path,
  };

  if (outreachToken) {
    await recordOutreachPreviewEvent({ token: outreachToken, eventType, request: requestFacts });
  } else {
    await recordPreviewEvent({ token, eventType, request: requestFacts });
  }

  return new NextResponse(null, { status: 204 });
}
