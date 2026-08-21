"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leadKeys, markSent } from "@/features/leads/api/leads.api";
import type { Lead } from "@/features/leads/types";
import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  lead: Lead;
  /** Overrides the lead's precomputed message when the user has edited it. */
  message?: string;
  atCap?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

/**
 * Opens WhatsApp with the message pre-filled and records the touch.
 *
 * Opening the chat is the closest thing to proof a message was sent — the send
 * itself happens inside WhatsApp, where we cannot observe it — so the touch is
 * recorded on tap.
 */
export function WhatsAppButton({
  lead,
  message,
  atCap = false,
  size = "default",
  className,
  label = "WhatsApp",
}: WhatsAppButtonProps) {
  const queryClient = useQueryClient();
  const text = message ?? lead.nextMessage;

  const sent = useMutation({
    mutationFn: () => markSent(lead._id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: leadKeys.all }),
  });

  if (!lead.waNumber) {
    return (
      <Button variant="outline" size={size} className={className} asChild>
        <a href={`tel:${lead.phone}`}>Call instead</a>
      </Button>
    );
  }

  const href = `https://wa.me/${lead.waNumber}?text=${encodeURIComponent(text)}`;

  return (
    <Button
      asChild
      size={size}
      variant={atCap ? "outline" : "default"}
      className={cn(className)}
      title={atCap ? "You are past today's cap — better to stop here" : undefined}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // Stops the click bubbling to the card's stretched link, which would
          // navigate to the detail page at the same time.
          e.stopPropagation();
          sent.mutate();
        }}
      >
        {sent.isSuccess ? <Check /> : <Send />}
        {sent.isSuccess ? "Sent" : label}
      </a>
    </Button>
  );
}
