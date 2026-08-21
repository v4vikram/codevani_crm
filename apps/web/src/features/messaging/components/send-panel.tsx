"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client";
import {
  fetchNextMessage,
  fetchTodayUsage,
  leadKeys,
  markSent,
} from "@/features/leads/api/leads.api";
import type { Lead } from "@/features/leads/types";

/**
 * The daily-cap guard is the whole reason sending stays manual. WhatsApp bans
 * numbers based on how recipients react, so the cap is a deliberate brake, not
 * a technical limit.
 */
export function SendPanel({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: next, isPending } = useQuery({
    queryKey: leadKeys.message(lead._id),
    queryFn: () => fetchNextMessage(lead._id),
  });

  const { data: usage } = useQuery({
    queryKey: leadKeys.usage(),
    queryFn: fetchTodayUsage,
  });

  const sent = useMutation({
    mutationFn: () => markSent(lead._id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
      setEdited(null);
    },
  });

  if (isPending || !next) return <Skeleton className="h-64 w-full" />;

  const message = edited ?? next.message;
  const atCap = usage ? usage.sentToday >= usage.cap : false;
  const noNumber = !lead.waNumber;

  // Rebuild the link so edits to the text are carried into WhatsApp.
  const waUrl = lead.waNumber
    ? `https://wa.me/${lead.waNumber}?text=${encodeURIComponent(message)}`
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the textarea is selectable as a fallback */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {next.touch === 1 ? "First message" : `Follow-up ${next.touch - 1}`}
        </h2>
        {usage && (
          <span
            className={
              atCap ? "text-sm font-medium text-warning" : "text-sm text-muted-foreground"
            }
          >
            {usage.sentToday}/{usage.cap} today
          </span>
        )}
      </div>

      <Textarea
        value={message}
        onChange={(e) => setEdited(e.target.value)}
        rows={9}
        className="text-[15px] leading-relaxed"
        aria-label="Message to send"
      />
      <p className="text-xs text-muted-foreground">
        Read it before sending. Edits here go into WhatsApp with you.
      </p>

      {atCap && (
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          You have hit today&apos;s cap. Stopping here is what keeps your number alive — carry on
          tomorrow.
        </p>
      )}

      {noNumber && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          This lead&apos;s phone number could not be read, so WhatsApp cannot be opened. Call{" "}
          {lead.phone} instead.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="flex-1" disabled={noNumber}>
          <a
            href={waUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            // Opening WhatsApp is the closest thing to proof a message was sent,
            // so that is where the touch gets recorded.
            onClick={() => {
              if (!noNumber) sent.mutate();
            }}
          >
            <Send /> Open WhatsApp
          </a>
        </Button>
        <Button variant="outline" size="lg" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {sent.isError && (
        <p className="text-sm text-destructive">{apiErrorMessage(sent.error)}</p>
      )}
      {sent.isSuccess && (
        <p className="text-sm text-success">
          Marked as sent. Follow-up scheduled automatically.
        </p>
      )}
    </div>
  );
}
