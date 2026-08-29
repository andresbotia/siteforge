import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { Card, CardBody } from "@/components/shared/card";
import { getAuthConfig, POST_LOGIN_PATH } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(POST_LOGIN_PATH);
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight">SiteForge</p>
          <p className="mt-1 text-sm text-muted-foreground">
            AI Website Operations
          </p>
        </div>
        <Card>
          <CardBody className="p-5">
            <h1 className="mb-4 text-sm font-medium">Admin sign in</h1>
            <LoginForm configured={Boolean(getAuthConfig())} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
