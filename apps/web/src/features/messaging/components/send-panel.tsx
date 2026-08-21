"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchTodayUsage, leadKeys } from "@/features/leads/api/leads.api";
import type { Lead } from "@/features/leads/types";
import { WhatsAppButton } from "./whatsapp-button";

/**
 * The full send view: read the message, edit it if it reads wrong, then send.
 * The list has a one-tap version of the same action for when no edit is needed.
 */
export function SendPanel({ lead }: { lead: Lead }) {
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: usage } = useQuery({ queryKey: leadKeys.usage(), queryFn: fetchTodayUsage });

  const message = edited ?? lead.nextMessage;
  const atCap = usage ? usage.sentToday >= usage.cap : false;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the textarea is still selectable */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {lead.nextTouch === 1 ? "First message" : `Follow-up ${lead.nextTouch - 1}`}
        </h2>
        {usage && (
          <span className={atCap ? "text-sm font-medium text-warning" : "text-sm text-muted-foreground"}>
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

      {!lead.waNumber && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          This lead&apos;s phone number could not be read, so WhatsApp cannot be opened. Call{" "}
          {lead.phone} instead.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <WhatsAppButton
          lead={lead}
          message={message}
          atCap={atCap}
          size="lg"
          className="flex-1"
          label="Open WhatsApp"
        />
        <Button variant="outline" size="lg" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
