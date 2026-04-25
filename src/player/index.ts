import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { Client } from "discord.js";
import { Player, type Track } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import {
  SpotifyExtractor,
  SoundCloudExtractor,
  AppleMusicExtractor,
  AttachmentExtractor,
} from "@discord-player/extractor";
import ffmpegStatic from "ffmpeg-static";
import { config } from "../config.js";
import { logger } from "../logger.js";

export { registerPlayerEvents } from "./events.js";

let singleton: Player | null = null;

function resolveFfmpegPath(): string | undefined {
  const fromEnv = config.FFMPEG_PATH.trim() || process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (process.platform === "linux" && existsSync("/usr/bin/ffmpeg")) {
    return "/usr/bin/ffmpeg";
  }
  return ffmpegStatic ?? undefined;
}

function resolveYtDlpPath(): string {
  const fromEnv = process.env.YT_DLP_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (process.platform === "linux" && existsSync("/usr/bin/yt-dlp")) {
    return "/usr/bin/yt-dlp";
  }
  return "yt-dlp";
}

/** Write Netscape cookie text to a tmp file for yt-dlp's --cookies flag. */
function writeCookieFile(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const expanded = trimmed.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  if (!/^#|\n.+\t.+\t/.test(expanded)) return null;
  const dir = mkdtempSync(join(tmpdir(), "ymcookie-"));
  const path = join(dir, "cookies.txt");
  writeFileSync(path, expanded.startsWith("#") ? expanded : `# Netscape HTTP Cookie File\n${expanded}`, "utf8");
  return path;
}

function createYtDlpStream(track: Track, ytDlpPath: string, cookieFile: string | null) {
  const args = [
    "-f",
    "bestaudio[ext=webm]/bestaudio/best",
    "-o",
    "-",
    "--no-warnings",
    "--no-progress",
    "--no-playlist",
    "--quiet",
    ...(cookieFile ? ["--cookies", cookieFile] : []),
    track.url,
  ];
  logger.debug({ url: track.url, ytDlpPath }, "spawning yt-dlp");
  const proc = spawn(ytDlpPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  proc.stderr.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) logger.warn({ msg }, "yt-dlp stderr");
  });
  proc.on("error", (err) => logger.error({ err }, "yt-dlp spawn error"));
  proc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      logger.warn({ code, signal }, "yt-dlp exited non-zero");
    }
  });
  const kill = () => {
    if (!proc.killed) proc.kill();
  };
  proc.stdout.on("close", kill);
  proc.stdout.on("error", kill);
  return proc.stdout;
}

function normalizeYoutubeCookie(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // dotenv expands \n inside double quotes but not \t — Netscape cookie files are tab-separated
  // so we have to expand \t ourselves, otherwise split("\t") fails and every row is dropped.
  const expanded = trimmed.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  const looksLikeNetscape = /^#|\n.+\t.+\t/.test(expanded);
  if (!looksLikeNetscape) return expanded;
  const pairs: string[] = [];
  for (const line of expanded.split(/\r?\n/)) {
    const row = line.trim();
    if (!row || row.startsWith("#")) continue;
    const cols = row.split("\t");
    if (cols.length < 7) continue;
    const name = cols[5];
    const value = cols[6];
    if (name) pairs.push(`${name}=${value}`);
  }
  return pairs.join("; ");
}

export async function createPlayer(client: Client): Promise<Player> {
  if (singleton) return singleton;

  const ffmpegPath = resolveFfmpegPath();
  const player = new Player(client, {
    skipFFmpeg: false,
    ...(ffmpegPath ? { ffmpegPath } : {}),
  });

  player.on("debug", (msg) => logger.debug({ msg }, "discord-player"));

  player.extractors.on("error", (_ctx, extractor, err) => {
    logger.error(
      { err, extractor: extractor?.identifier },
      "extractor activation failed",
    );
  });

  const youtubeCookie = normalizeYoutubeCookie(config.YOUTUBE_COOKIE);
  const cookiePairs = youtubeCookie ? youtubeCookie.split("; ").length : 0;
  const ytDlpPath = resolveYtDlpPath();
  const ytDlpCookieFile = writeCookieFile(config.YOUTUBE_COOKIE);
  logger.info(
    { cookiePairs, ytDlpPath, hasCookieFile: Boolean(ytDlpCookieFile) },
    "configuring YouTube extractor (yt-dlp stream)",
  );
  const ytResult = await player.extractors.register(YoutubeiExtractor, {
    createStream: async (track) => createYtDlpStream(track, ytDlpPath, ytDlpCookieFile),
    ...(youtubeCookie ? { cookie: youtubeCookie } : {}),
  });
  if (ytResult) {
    const originalHandle = ytResult.handle.bind(ytResult);
    ytResult.handle = async (query, context) => {
      try {
        return await originalHandle(query, context);
      } catch (err) {
        logger.error({ err, query, type: context.type }, "YoutubeiExtractor.handle threw");
        throw err;
      }
    };
  }
  if (!ytResult) {
    logger.error("YoutubeiExtractor failed to register — YouTube playback will not work");
  }
  await player.extractors.register(SpotifyExtractor, {});
  await player.extractors.register(SoundCloudExtractor, {});
  await player.extractors.register(AppleMusicExtractor, {});
  await player.extractors.register(AttachmentExtractor, {});

  const registered = [...player.extractors.store.keys()];
  logger.info(
    { count: registered.length, extractors: registered },
    "player initialized with extractors",
  );

  singleton = player;
  return player;
}

export function getPlayer(): Player {
  if (!singleton) {
    throw new Error("Player not initialized — call createPlayer(client) first");
  }
  return singleton;
}
