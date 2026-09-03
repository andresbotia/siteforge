import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Today" };

/**
 * M10 Task 1 stub. The work-item queue lands here in Task 3; until then this
 * is the post-login page and points at the pipeline.
 */
export default function TodayPage() {
  return (
    <>
      <PageHeader
        title="Today"
        description="Your work queue. Items appear here as the pipeline produces them."
      />
      <p className="text-sm text-muted">
        Nothing to show yet.{" "}
        <Link href="/leads" className="text-accent hover:underline">
          Go to the pipeline
        </Link>
        .
      </p>
    </>
  );
}
