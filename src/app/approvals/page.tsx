import type { Metadata } from "next";
import { ApprovalsView } from "@/components/approvals/approvals-view";
import { listApprovals } from "@/data/approvals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Approvals",
};

export default async function ApprovalsPage() {
  const approvals = await listApprovals();
  return <ApprovalsView approvals={approvals} />;
}
