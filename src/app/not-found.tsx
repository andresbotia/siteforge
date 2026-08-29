import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Not found"
        description="That route does not exist in the SiteForge application shell."
      />
      <Link href="/" className="text-sm text-accent hover:underline">
        Back to overview
      </Link>
    </>
  );
}
