import type { LeadType } from "../leads/lead.rules.js";

export interface MessageInput {
  name: string;
  area?: string;
  rating?: number;
  reviews?: number;
  leadType: LeadType;
}

export type Touch = 1 | 2 | 3;

const stripSuffix = (name: string) =>
  name.replace(/\s*(pvt\.?\s*ltd\.?|private limited|llp|&\s*co\.?)\s*$/i, "").trim();

/**
 * Lead with THEIR data, not your services, so it reads as noticed-you rather
 * than blasted-everyone. Keep it short: long messages from unknown numbers get
 * ignored or reported, and reports are what get a WhatsApp number banned.
 */
export function buildMessage(lead: MessageInput, from: string, touch: Touch = 1): string {
  const name = stripSuffix(lead.name);
  const where = lead.area ? ` in ${lead.area}` : "";
  const rating = lead.rating ?? 0;
  const reviews = lead.reviews ?? 0;

  if (touch === 2) {
    return `Namaste 🙏 Following up on my message about a website for ${name}.

I've kept the free sample offer open — takes me a day and costs you nothing. Worth a look?

— ${from}`;
  }

  if (touch === 3) {
    return `Hi, last message from me about ${name}'s website — I won't keep bothering you 🙏

If it's just bad timing, tell me when to check back. If it's a no, that's completely fine.

— ${from}`;
  }

  let hook: string;
  if (reviews >= 20 && rating >= 4.3) {
    hook = `${rating}★ from ${reviews} reviews — that's a strong reputation`;
  } else if (reviews >= 5) {
    hook = `${rating}★ from ${reviews} reviews`;
  } else {
    hook = `you're listed on Google Maps`;
  }

  const gap =
    lead.leadType === "SOCIAL_ONLY"
      ? `but there's no website linked — just a social page, so people who search for you have nowhere proper to land`
      : `but there's no website linked, so people who search for you have nowhere to land`;

  return `Namaste 🙏 I came across ${name}${where} on Google — ${hook}, ${gap}.

I design websites for construction & property firms in NCR. Can I make you a free sample page with your name and project photos? No charge, no commitment — if you don't like it, just ignore it.

— ${from}`;
}

export function waLink(waNumber: string, message: string): string {
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}
