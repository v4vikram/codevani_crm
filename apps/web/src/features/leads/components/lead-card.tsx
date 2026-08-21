"use client";

import Link from "next/link";
import { Star, MessageSquare, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/features/messaging/components/whatsapp-button";
import { timeAgo, isOverdue } from "@/lib/utils";
import { LEAD_TYPE_META, STATUS_META, type Lead } from "../types";

/**
 * One row in the queue.
 *
 * The card uses a stretched link: the whole surface opens the detail page, but
 * the WhatsApp button sits above it so you can send straight from the list.
 * A real <button> inside an <a> would be invalid HTML and swallow the tap.
 */
export function LeadCard({ lead, atCap = false }: { lead: Lead; atCap?: boolean }) {
  const type = LEAD_TYPE_META[lead.leadType];
  const status = STATUS_META[lead.status];
  const due = isOverdue(lead.nextFollowUpAt);

  return (
    <div className="relative rounded-lg border border-border bg-card p-4 transition-colors focus-within:border-primary/40 hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">
          <Link
            href={`/leads/${lead._id}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {lead.name}
          </Link>
        </h3>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-muted-foreground">
          {lead.score}
          <ChevronRight className="size-4" />
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
          <Badge className="inline-flex items-center gap-1 bg-warning/20 text-warning">
            <Clock className="size-3" />
            follow up
          </Badge>
        )}
        {lead.nextFollowUpAt && !due && (
          <span className="text-xs text-muted-foreground">
            next {timeAgo(lead.nextFollowUpAt).replace(" ago", " from now")}
          </span>
        )}
      </div>

      {/* z-10 lifts the button above the stretched link's ::after overlay. */}
      <div className="relative z-10 mt-3 flex items-center gap-2">
        <WhatsAppButton
          lead={lead}
          atCap={atCap}
          size="sm"
          label={lead.nextTouch === 1 ? "WhatsApp" : `Follow-up ${lead.nextTouch - 1}`}
        />
        <span className="truncate text-xs text-muted-foreground">{lead.phone}</span>
      </div>
    </div>
  );
}
