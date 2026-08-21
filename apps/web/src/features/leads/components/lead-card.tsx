import Link from "next/link";
import { Star, MessageSquare, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo, isOverdue } from "@/lib/utils";
import { LEAD_TYPE_META, STATUS_META, type Lead } from "../types";

/**
 * One row in the queue. The whole card is the tap target -- on a phone,
 * small inline links are a miss-tap waiting to happen.
 */
export function LeadCard({ lead }: { lead: Lead }) {
  const type = LEAD_TYPE_META[lead.leadType];
  const status = STATUS_META[lead.status];
  const due = isOverdue(lead.nextFollowUpAt);

  return (
    <Link
      href={`/leads/${lead._id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{lead.name}</h3>
        <span
          className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground"
          title="Lead score"
        >
          {lead.score}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
        {lead.reviews > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-current" />
            {lead.rating} · {lead.reviews} reviews
          </span>
        ) : (
          <span>no reviews yet</span>
        )}
        {lead.area && <span>{lead.area}</span>}
        {lead.touches > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {lead.touches} sent
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge className={type.className}>{type.label}</Badge>
        <Badge className={status.className}>{status.label}</Badge>
        {due && (
          <Badge className="bg-warning/20 text-warning inline-flex items-center gap-1">
            <Clock className="size-3" />
            follow up
          </Badge>
        )}
        {lead.nextFollowUpAt && !due && (
          <span className={cn("text-xs text-muted-foreground")}>
            next {timeAgo(lead.nextFollowUpAt).replace(" ago", " from now")}
          </span>
        )}
      </div>
    </Link>
  );
}
