import type { Player, GuildQueue } from "discord-player";
import type { TextBasedChannel, Message } from "discord.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { buildNowPlayingEmbed, buildQueueEndedEmbed } from "../ui/nowPlaying.js";
import { pick, messages } from "../ui/messages.js";

export interface QueueMetadata {
  channel: TextBasedChannel;
  nowPlayingMessageId?: string;
  idleTimer?: NodeJS.Timeout;
}

function isSendable(
  channel: TextBasedChannel,
): channel is TextBasedChannel & { send: (...args: unknown[]) => Promise<Message> } {
  return "send" in channel && typeof (channel as { send?: unknown }).send === "function";
}

async function safeDeleteNowPlaying(queue: GuildQueue<QueueMetadata>): Promise<void> {
  const meta = queue.metadata;
  if (!meta?.channel || !meta.nowPlayingMessageId) return;
  if (!isSendable(meta.channel)) return;
  try {
    const msg = await meta.channel.messages.fetch(meta.nowPlayingMessageId);
    await msg.delete();
  } catch {
    // message already gone
  } finally {
    meta.nowPlayingMessageId = undefined;
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
      if (meta.channel && isSendable(meta.channel)) {
        void meta.channel.send({ content: pick(messages.disconnected) });
      }
      queue.delete();
    } catch (err) {
      logger.warn({ err }, "idle disconnect failed");
    }
  }, config.IDLE_DISCONNECT_MS);
}

export function registerPlayerEvents(player: Player): void {
  player.events.on("playerStart", async (queue, track) => {
    const meta = queue.metadata as QueueMetadata | undefined;
    clearIdleTimer(queue as GuildQueue<QueueMetadata>);
    if (!meta?.channel || !isSendable(meta.channel)) return;

    try {
      await safeDeleteNowPlaying(queue as GuildQueue<QueueMetadata>);
      const msg = await meta.channel.send({
        embeds: [buildNowPlayingEmbed(track, queue)],
      });
      meta.nowPlayingMessageId = msg.id;
    } catch (err) {
      logger.warn({ err }, "failed to send now-playing message");
    }
  });

  player.events.on("playerFinish", async (queue) => {
    await safeDeleteNowPlaying(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("emptyQueue", async (queue) => {
    const meta = queue.metadata as QueueMetadata | undefined;
    await safeDeleteNowPlaying(queue as GuildQueue<QueueMetadata>);
    if (meta?.channel && isSendable(meta.channel)) {
      try {
        await meta.channel.send({ embeds: [buildQueueEndedEmbed()] });
      } catch (err) {
        logger.warn({ err }, "failed to send queue-ended message");
      }
    }
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
    void safeDeleteNowPlaying(queue as GuildQueue<QueueMetadata>);
  });

  player.events.on("queueDelete", (queue) => {
    clearIdleTimer(queue as GuildQueue<QueueMetadata>);
    void safeDeleteNowPlaying(queue as GuildQueue<QueueMetadata>);
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
