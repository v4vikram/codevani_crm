import nodemailer from "nodemailer";
import { env } from "./env.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Filled instead of sending when NODE_ENV is "test", so the smoke test can read the link. */
export const testOutbox: Mail[] = [];

const gmailConfigured = Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);

const transport = gmailConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    })
  : null;

export function mailConfigured(): boolean {
  return gmailConfigured;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (env.NODE_ENV === "test") {
    testOutbox.push(mail);
    return;
  }

  if (!transport) {
    if (env.isProduction) {
      throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not set; cannot send email.");
    }
    console.log(`[mail] Gmail is not configured, so this was not sent.\n  to: ${mail.to}\n  ${mail.text}`);
    return;
  }

  await transport.sendMail({ from: `Peoples <${env.GMAIL_USER}>`, ...mail });
}
