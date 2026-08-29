"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/shared/button";
import { Field, TextInput } from "@/components/shared/field";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field label="Email" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={!configured || pending}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={!configured || pending}
        />
      </Field>
      {state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {!configured ? (
        <p className="text-sm text-danger" role="alert">
          Sign-in is not configured.
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={!configured || pending}>
        {pending ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
