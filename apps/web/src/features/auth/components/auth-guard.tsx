"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../auth-context";

/** Reachable without a session — you can't sign in or recover a password otherwise. */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

/**
 * Gates the app shell. This is convenience, not security -- the API rejects
 * unauthenticated requests on its own, so a bypass here reveals nothing.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicPage) router.replace("/login");
  }, [loading, user, isPublicPage, router]);

  if (isPublicPage) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="space-y-3 pt-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
