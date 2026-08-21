"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Phone, Star } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client";
import { SendPanel } from "@/features/messaging/components/send-panel";
import { fetchLead, leadKeys, updateLead } from "../api/leads.api";
import {
  DEAD_REASONS,
  DEAD_REASON_LABELS,
  LEAD_TYPE_META,
  STATUSES,
  STATUS_META,
  type DeadReason,
  type Status,
} from "../types";
import { timeAgo } from "@/lib/utils";
import { useState } from "react";

export function LeadDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: () => fetchLead(id),
  });

  const mutation = useMutation({
    mutationFn: (patch: { status?: Status; notes?: string; deadReason?: DeadReason | null }) =>
      updateLead(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
      setNoteDraft(null);
    },
  });

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (isError) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {apiErrorMessage(error)}
      </p>
    );
  }

  const { lead, events } = data;
  const type = LEAD_TYPE_META[lead.leadType];

  return (
    <div className="space-y-5">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to leads
      </Link>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold leading-tight">{lead.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          {lead.reviews > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-current" />
              {lead.rating} · {lead.reviews} reviews
            </span>
          )}
          {lead.category && <span>{lead.category}</span>}
          {lead.area && <span>{lead.area}</span>}
          <span>score {lead.score}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={type.className}>{type.label}</Badge>
          <Badge className={STATUS_META[lead.status].className}>
            {STATUS_META[lead.status].label}
          </Badge>
        </div>
        {lead.address && <p className="text-sm text-muted-foreground">{lead.address}</p>}
      </header>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`tel:${lead.phone}`}>
            <Phone /> {lead.phone}
          </a>
        </Button>
        {lead.mapsUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Google listing
            </a>
          </Button>
        )}
        {lead.websiteUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Their social page
            </a>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <SendPanel lead={lead} />
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="font-semibold">What happened?</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={lead.status === s ? "default" : "outline"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status: s })}
            >
              {STATUS_META[s].label}
            </Button>
          ))}
        </div>

        {lead.status === "DEAD" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {DEAD_REASONS.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={lead.deadReason === r ? "secondary" : "ghost"}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ deadReason: r })}
              >
                {DEAD_REASON_LABELS[r]}
              </Button>
            ))}
          </div>
        )}
        {mutation.isError && (
          <p className="text-sm text-destructive">{apiErrorMessage(mutation.error)}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Notes</h2>
        <Textarea
          value={noteDraft ?? lead.notes}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="What did they say? Budget, timing, who decides."
          rows={3}
        />
        {noteDraft !== null && noteDraft !== lead.notes && (
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ notes: noteDraft })}
          >
            Save note
          </Button>
        )}
      </section>

      {events.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">History</h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {events.map((e) => (
              <li key={e._id} className="flex justify-between gap-3">
                <span>{describeEvent(e.type, e.touch, e.from, e.to)}</span>
                <span className="shrink-0 tabular-nums">{timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function describeEvent(type: string, touch: number | null, from: string, to: string): string {
  switch (type) {
    case "IMPORTED":
      return "Imported from CSV";
    case "MESSAGE_SENT":
      return touch === 1 ? "First message sent" : `Follow-up ${(touch ?? 1) - 1} sent`;
    case "STATUS_CHANGED":
      return `Status ${from.toLowerCase()} → ${to.toLowerCase()}`;
    case "NOTE_ADDED":
      return "Note added";
    default:
      return type;
  }
}
