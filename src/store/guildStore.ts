import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";

const STORE_PATH = join(process.cwd(), "data", "guilds.json");

export interface GuildEntry {
  channelId: string;
  playerMessageId: string;
}

type Store = Record<string, GuildEntry>;

function loadFromDisk(): Store {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

function saveToDisk(store: Store): void {
  try {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    logger.warn({ err }, "guild store: failed to persist — data will be lost on restart");
  }
}

const cache: Store = loadFromDisk();

export function getGuildEntry(guildId: string): GuildEntry | undefined {
  return cache[guildId];
}

export function setGuildEntry(guildId: string, entry: GuildEntry): void {
  cache[guildId] = entry;
  saveToDisk(cache);
}
