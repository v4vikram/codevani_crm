"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client";
import { authKeys, fetchSetupState, login, register } from "../api/auth.api";
import { useAuth } from "../auth-context";

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [mode, setMode] = useState<"login" | "register" | null>(null);

  const setup = useQuery({ queryKey: authKeys.setup, queryFn: fetchSetupState });

  const submit = useMutation({
    mutationFn: async () => {
      const isRegister = (mode ?? (setup.data?.needsSetup ? "register" : "login")) === "register";
      return isRegister
        ? register({ email, password, name, signupCode: signupCode || undefined })
        : login({ email, password });
    },
    onSuccess: ({ token, user }) => {
      signIn(token, user);
      router.replace("/");
    },
  });

  if (setup.isPending) return <Skeleton className="h-72 w-full" />;

  // On a brand-new deployment there is nobody to log in as, so offer setup.
  const firstRun = setup.data?.needsSetup ?? false;
  const isRegister = (mode ?? (firstRun ? "register" : "login")) === "register";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {firstRun ? "Create your account" : isRegister ? "Add an account" : "Sign in"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {firstRun
            ? "Nobody has signed up yet, so this first account is yours."
            : "Your leads and their phone numbers are behind this."}
        </p>
      </div>

      {isRegister && (
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Vikram"
          />
        </div>
      )}

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

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isRegister ? "new-password" : "current-password"}
        />
        {isRegister && (
          <p className="text-xs text-muted-foreground">At least 10 characters.</p>
        )}
      </div>

      {isRegister && !firstRun && (
        <div className="space-y-1.5">
          <label htmlFor="signupCode" className="text-sm font-medium">
            Signup code
          </label>
          <Input
            id="signupCode"
            value={signupCode}
            onChange={(e) => setSignupCode(e.target.value)}
            placeholder="From the API's SIGNUP_CODE setting"
          />
        </div>
      )}

      {submit.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {apiErrorMessage(submit.error)}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
        {isRegister ? <UserPlus /> : <LogIn />}
        {submit.isPending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </Button>

      {!firstRun && (
        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(isRegister ? "login" : "register")}
        >
          {isRegister ? "I already have an account" : "Add another account"}
        </button>
      )}
    </form>
  );
}
