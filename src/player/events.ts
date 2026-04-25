import type { Player, GuildQueue } from "discord-player";
import type { TextBasedChannel } from "discord.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { buildNowPlayingEmbed, buildIdleEmbed } from "../ui/nowPlaying.js";
import { pick, messages } from "../ui/messages.js";
import { getGuildEntry } from "../store/guildStore.js";

export interface QueueMetadata {
  channel: TextBasedChannel;
  progressInterval?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
}

function isSendable(
  channel: TextBasedChannel,
): channel is TextBasedChannel & { send: (...args: unknown[]) => Promise<unknown> } {
  return "send" in channel && typeof (channel as { send?: unknown }).send === "function";
}

export async function editPlayerDisplay(
  queue: GuildQueue<QueueMetadata>,
  embed: ReturnType<typeof buildNowPlayingEmbed>,
): Promise<void> {
  const entry = getGuildEntry(queue.guild.id);
  if (!entry) {
    logger.warn({ guildId: queue.guild.id }, "no guild entry found — run /setup first");
    return;
  }
  try {
    const channel = await queue.player.client.channels.fetch(entry.channelId);
    if (!channel?.isTextBased()) return;
    const msg = await channel.messages.fetch(entry.playerMessageId);
    await msg.edit({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err, guildId: queue.guild.id }, "failed to edit player display");
  }
}

function clearProgressInterval(queue: GuildQueue<QueueMetadata>): void {
  const meta = queue.metadata;
  if (meta?.progressInterval) {
    clearInterval(meta.progressInterval);
    meta.progressInterval = undefined;
  }
}

function clearIdleTimer(queue: GuildQueue<QueueMetadata>): void {
  const meta = queue.metadata;
  if (meta?.idleTimer) {
    clearTimeout(meta.idleTimer);
    meta.idleTimer = undefined;
  }
}

function scheduleIdleDisconnect(queue: GuildQueue<QueueMetadata>): void {
  const meta = queue.metadata;
  if (!meta) return;
  clearIdleTimer(queue);
  if (config.IDLE_DISCONNECT_MS <= 0) return;
  meta.idleTimer = setTimeout(() => {
    if (queue.isPlaying() || queue.tracks.size > 0) return;
    try {
      queue.delete();
    } catch (err) {
      logger.warn({ err }, "idle disconnect failed");
    }
  }, config.IDLE_DISCONNECT_MS);
}

async function resetPlayerDisplay(queue: GuildQueue<QueueMetadata>): Promise<void> {
  clearProgressInterval(queue);
  await editPlayerDisplay(queue, buildIdleEmbed());
}

function startProgressInterval(queue: GuildQueue<QueueMetadata>): void {
  const meta = queue.metadata;
  if (!meta) return;
  clearProgressInterval(queue);
  meta.progressInterval = setInterval(() => {
    if (!queue.isPlaying() || !queue.currentTrack) return;
    void editPlayerDisplay(queue, buildNowPlayingEmbed(queue.currentTrack, queue));
  }, 5_000);
}

export function registerPlayerEvents(player: Player): void {
  player.events.on("audioTrackAdd", (queue, track) => {
    logger.info(
      { guildId: queue.guild.id, title: track.title, url: track.url, duration: track.duration },
      "audioTrackAdd",
    );
  });

  player.events.on("playerStart", async (queue, track) => {
    logger.info(
      { guildId: queue.guild.id, title: track.title, durationMS: track.durationMS },
      "playerStart",
    );
    clearIdleTimer(queue as GuildQueue<QueueMetadata>);
    await editPlayerDisplay(
      queue as GuildQueue<QueueMetadata>,
      buildNowPlayingEmbed(track, queue),
    );
    startProgressInterval(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("playerFinish", (queue, track) => {
    logger.info({ guildId: queue.guild.id, title: track.title }, "playerFinish");
    clearProgressInterval(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("playerSkip", (queue, track, reason, description) => {
    logger.warn(
      { guildId: queue.guild.id, title: track.title, reason, description },
      "playerSkip",
    );
  });

  player.events.on("emptyQueue", async (queue) => {
    await resetPlayerDisplay(queue as GuildQueue<QueueMetadata>);
    scheduleIdleDisconnect(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("emptyChannel", (queue) => {
    logger.info({ guildId: queue.guild.id }, "voice channel empty — disconnecting");
    try {
      queue.delete();
    } catch (err) {
      logger.warn({ err }, "failed to delete empty queue");
    }
  });

  player.events.on("disconnect", (queue) => {
    clearIdleTimer(queue as GuildQueue<QueueMetadata>);
    void resetPlayerDisplay(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("queueDelete", (queue) => {
    clearIdleTimer(queue as GuildQueue<QueueMetadata>);
    void resetPlayerDisplay(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("error", (queue, err) => {
    logger.error({ err, guildId: queue.guild.id }, "player queue error");
  });

  player.events.on("playerError", (queue, err) => {
    logger.error({ err, guildId: queue.guild.id }, "player playback error");
    const meta = queue.metadata as QueueMetadata | undefined;
    if (meta?.channel && isSendable(meta.channel)) {
      void meta.channel.send({ content: pick(messages.playbackError) });
    }
  });
}
