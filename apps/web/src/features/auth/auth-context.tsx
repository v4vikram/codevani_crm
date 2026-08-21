"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthToken, getAuthToken, onUnauthorized } from "@/lib/api-client";
import { fetchMe } from "./api/auth.api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  /** True until we know whether the stored token is still valid. */
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  const signOut = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    queryClient.clear(); // never leave one account's leads cached for the next
    router.replace("/login");
  }, [queryClient, router]);

  const signIn = useCallback((token: string, nextUser: User) => {
    setAuthToken(token);
    setUser(nextUser);
  }, []);

  // A token can expire or be revoked while the tab is open; when the API says
  // 401 anywhere, drop the session rather than letting pages fail one by one.
  useEffect(() => onUnauthorized(signOut), [signOut]);

  // Restore the session from storage on first load. A stored token may have
  // expired, so it is only trusted once the API confirms it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Yield first: setting state synchronously inside an effect body causes
      // cascading renders, and React 19 rightly complains about it.
      await Promise.resolve();

      const token = getAuthToken();
      let restored: User | null = null;

      if (token) {
        try {
          restored = await fetchMe();
        } catch {
          setAuthToken(null); // expired or revoked
        }
      }

      if (cancelled) return;
      setUser(restored);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
