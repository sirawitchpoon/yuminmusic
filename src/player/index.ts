import type { Client } from "discord.js";
import { Player } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import {
  SpotifyExtractor,
  SoundCloudExtractor,
  AppleMusicExtractor,
  AttachmentExtractor,
} from "@discord-player/extractor";
import { logger } from "../logger.js";

export { registerPlayerEvents } from "./events.js";

let singleton: Player | null = null;

export async function createPlayer(client: Client): Promise<Player> {
  if (singleton) return singleton;

  const player = new Player(client, {
    skipFFmpeg: false,
  });

  await player.extractors.register(YoutubeiExtractor, {});
  await player.extractors.register(SpotifyExtractor, {});
  await player.extractors.register(SoundCloudExtractor, {});
  await player.extractors.register(AppleMusicExtractor, {});
  await player.extractors.register(AttachmentExtractor, {});

  logger.info(
    { extractors: player.extractors.store.size },
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
