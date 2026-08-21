"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Upload, Sparkles, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";

const TABS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

/**
 * Bottom bar on phones, top bar on desktop. Bottom placement matters: this is
 * used one-handed while walking, and the thumb does not reach the top.
 */
export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // Nothing to navigate to until you are signed in.
  if (!user || pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card safe-bottom sm:sticky sm:top-0 sm:bottom-auto sm:border-b sm:border-t-0 sm:pb-0">
      <div className="mx-auto flex max-w-3xl items-center">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:py-3 sm:text-sm",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5 sm:size-4" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title={user.email}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <LogOut className="size-5 sm:size-4" />
          <span className="sm:sr-only">Out</span>
        </button>
      </div>
    </nav>
  );
}
