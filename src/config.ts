import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  GUILD_ID: z.string().min(1, "GUILD_ID is required"),
  ADMIN_ROLE_ID: z.string().optional().default(""),
  DJ_ROLE_ID: z.string().optional().default(""),
  SKIP_VOTE_RATIO: z
    .string()
    .optional()
    .default("0.5")
    .transform((v) => {
      const n = Number(v);
      if (Number.isNaN(n) || n <= 0 || n > 1) {
        throw new Error("SKIP_VOTE_RATIO must be a number between 0 (exclusive) and 1 (inclusive)");
      }
      return n;
    }),
  IDLE_DISCONNECT_MS: z
    .string()
    .optional()
    .default("300000")
    .transform((v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("IDLE_DISCONNECT_MS must be a non-negative number");
      }
      return n;
    }),
  DEFAULT_VOLUME: z
    .string()
    .optional()
    .default("50")
    .transform((v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error("DEFAULT_VOLUME must be between 0 and 100");
      }
      return n;
    }),
  PANEL_BANNER_PATH: z.string().optional().default("./assets/banner.png"),
  PANEL_GIF_PATH: z.string().optional().default("./assets/yui-idle.gif"),
  /** Optional Netscape-format cookie string for YouTube (helps when streams are blocked). */
  YOUTUBE_COOKIE: z.string().optional().default(""),
  /** Override ffmpeg binary (defaults: FFMPEG_PATH env, else Linux /usr/bin/ffmpeg, else ffmpeg-static). */
  FFMPEG_PATH: z.string().optional().default(""),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional()
    .default("info"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[config] Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;
