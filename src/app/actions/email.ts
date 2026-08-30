"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/guard";
import { sendInternalTestEmail } from "@/data/email";

export type EmailActionState =
  | { ok: true; messageId?: string; simulated?: boolean }
  | { ok: false; error: string }
  | null;

export async function sendInternalTestEmailAction(
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  await requireAdminSession();
  const recipient = String(formData.get("recipient") ?? "");
  const result = await sendInternalTestEmail({ recipient });
  revalidatePath("/settings");
  return result;
}
