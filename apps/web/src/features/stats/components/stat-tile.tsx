import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  emphasis?: "default" | "warning" | "success";
}

const EMPHASIS = {
  default: "text-foreground",
  warning: "text-warning",
  success: "text-success",
} as const;

export function StatTile({ label, value, hint, href, emphasis = "default" }: StatTileProps) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", EMPHASIS[emphasis])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = cn(
    "rounded-lg border border-border bg-card p-4",
    href && "transition-colors hover:border-primary/40",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
