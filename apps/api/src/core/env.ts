import "dotenv/config";
import { z } from "zod";

/**
 * Validated once at boot so a typo in a Render env var fails loudly here
 * rather than as a confusing runtime error three requests later.
 */
/**
 * A blank value in a hosting dashboard is a common mistake and means "not set",
 * not "set to empty string" — treat it as absent so optional vars stay optional.
 */
const optionalString = z
  .string()
  .transform((v) => v.trim() || undefined)
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: optionalString,

  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  SENDER_SIGNATURE: z.string().default("Vikram, Codevani"),
  FOLLOW_UP_DAYS: z.coerce.number().int().min(1).max(30).default(3),
  DAILY_SEND_CAP: z.coerce.number().int().min(1).max(200).default(30),

  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] invalid configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === "production",
};

export type Env = typeof env;
