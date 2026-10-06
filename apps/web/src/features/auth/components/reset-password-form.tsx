"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api-client";
import { resetPassword } from "../api/auth.api";
import { useAuth } from "../auth-context";

export function ResetPasswordForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signIn } = useAuth();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && password !== confirm;

  const reset = useMutation({
    mutationFn: () => resetPassword({ token, password }),
    onSuccess: ({ token: session, user }) => {
      queryClient.clear(); // drop anything cached under a previous session
      signIn(session, user);
      router.replace("/");
    },
  });

  if (!token) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">This link is incomplete</h1>
        <p className="text-sm text-muted-foreground">
          Open the link from your email again, or request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) reset.mutate();
      }}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ll be signed in afterwards, and signed out everywhere else.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <Input
          id="password"
          type="password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
      </div>

      {reset.isError && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{apiErrorMessage(reset.error)}</p>
          <Link href="/forgot-password" className="underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={reset.isPending || mismatch}>
        <KeyRound />
        {reset.isPending ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}
