"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api-client";
import { forgotPassword } from "../api/auth.api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const request = useMutation({ mutationFn: () => forgotPassword(email) });

  if (request.isSuccess) {
    return (
      <div className="space-y-4">
        <MailCheck className="size-8 text-primary" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If <span className="font-medium text-foreground">{email}</span> has an account, a reset
            link is on its way. It works for 30 minutes. Check spam if it doesn&apos;t show up.
          </p>
        </div>
        <Link
          href="/login"
          className="block text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        request.mutate();
      }}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to choose a new one.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      {request.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {apiErrorMessage(request.error)}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={request.isPending}>
        <Send />
        {request.isPending ? "Sending…" : "Send reset link"}
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}
