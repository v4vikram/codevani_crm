"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/features/auth/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Lead data changes only when you change it, so don't refetch on
            // every window focus -- on mobile that fires constantly.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Retrying a 401 just delays the redirect to the login page.
            retry: (count, error) =>
              (error as { response?: { status?: number } })?.response?.status === 401
                ? false
                : count < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
