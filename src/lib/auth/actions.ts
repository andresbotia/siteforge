"use server";

import { redirect } from "next/navigation";
import {
  getAuthConfig,
  LOGIN_PATH,
  POST_LOGIN_PATH,
} from "@/lib/auth/config";
import { createSession, destroySession } from "@/lib/auth/cookies";
import { credentialsMatch } from "@/lib/auth/session";

export type LoginState = {
  error: string;
} | null;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const config = getAuthConfig();
  if (!config) {
    return { error: "Sign-in is not configured." };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!credentialsMatch(email, password, config)) {
    return { error: "Invalid email or password." };
  }

  const created = await createSession(config.adminEmail);
  if (!created) {
    return { error: "Sign-in is not configured." };
  }

  redirect(POST_LOGIN_PATH);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect(LOGIN_PATH);
}
