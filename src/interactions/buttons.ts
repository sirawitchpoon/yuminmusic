import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
  type InteractionReplyOptions,
} from "discord.js";
import { useQueue, QueueRepeatMode } from "discord-player";
import { logger } from "../logger.js";
import { isDJ } from "../auth/roles.js";
import { pick, messages } from "../ui/messages.js";
import { buildQueueEmbed } from "../ui/queueList.js";
import { initiateSkipVote, handleVoteButton } from "../player/skipVote.js";

function ephemeral(content: string): InteractionReplyOptions {
  return { content, flags: MessageFlags.Ephemeral };
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  if (!customId.startsWith("ym:")) return;

  if (customId === "ym:play") return openPlayModal(interaction);
  if (customId === "ym:pause") return togglePause(interaction);
  if (customId === "ym:skip") return handleSkip(interaction);
  if (customId === "ym:queue") return showQueue(interaction);
  if (customId === "ym:loop") return cycleLoop(interaction);
  if (customId === "ym:stop") return handleStop(interaction);
  if (customId.startsWith("ym:vote:skip:")) {
    const trackId = customId.slice("ym:vote:skip:".length);
    return handleVoteFromButton(interaction, trackId);
  }

  logger.debug({ customId }, "unhandled button custom_id");
}

async function openPlayModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId("ym:modal:addTrack").setTitle("ยุยอยากฟังเพลงอะไรคะ~");
  const input = new TextInputBuilder()
    .setCustomId("query")
    .setLabel("วาง URL หรือพิมพ์ชื่อเพลง")
    .setPlaceholder("เช่น https://youtu.be/... หรือ YOASOBI Idol")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function togglePause(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const queue = useQueue(interaction.guildId);
  if (!queue || !queue.isPlaying()) {
    await interaction.reply(ephemeral(pick(messages.nothingPlaying)));
    return;
  }

  const paused = queue.node.isPaused();
  queue.node.setPaused(!paused);
  await interaction.reply({
    content: paused ? pick(messages.resumed) : pick(messages.paused),
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSkip(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const queue = useQueue(interaction.guildId);
  if (!queue || !queue.isPlaying()) {
    await interaction.reply(ephemeral(pick(messages.nothingPlaying)));
    return;
  }
  await initiateSkipVote(interaction, queue);
}

async function handleVoteFromButton(
  interaction: ButtonInteraction,
  trackId: string,
): Promise<void> {
  if (!interaction.guildId) return;
  const queue = useQueue(interaction.guildId);
  if (!queue || !queue.isPlaying()) {
    await interaction.reply(ephemeral("เพลงนี้ผ่านไปแล้วค่ะ~"));
    return;
  }
  await handleVoteButton(interaction, queue, trackId);
}

async function showQueue(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const queue = useQueue(interaction.guildId);
  if (!queue) {
    await interaction.reply(ephemeral(pick(messages.nothingPlaying)));
    return;
  }
  await interaction.reply({
    embeds: [buildQueueEmbed(queue)],
    flags: MessageFlags.Ephemeral,
  });
}

async function cycleLoop(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const queue = useQueue(interaction.guildId);
  if (!queue) {
    await interaction.reply(ephemeral(pick(messages.nothingPlaying)));
    return;
  }

  const member = interaction.member as GuildMember;
  if (!isDJ(member)) {
    await interaction.reply(ephemeral(pick(messages.notAuthorized)));
    return;
  }

  const next =
    queue.repeatMode === QueueRepeatMode.OFF
      ? QueueRepeatMode.TRACK
      : queue.repeatMode === QueueRepeatMode.TRACK
        ? QueueRepeatMode.QUEUE
        : QueueRepeatMode.OFF;
  queue.setRepeatMode(next);

  const msg =
    next === QueueRepeatMode.OFF
      ? pick(messages.loopOff)
      : next === QueueRepeatMode.TRACK
        ? pick(messages.loopTrack)
        : pick(messages.loopQueue);

  await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
}

async function handleStop(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const member = interaction.member as GuildMember;
  if (!isDJ(member)) {
    await interaction.reply(ephemeral(pick(messages.notAuthorized)));
    return;
  }

  const queue = useQueue(interaction.guildId);
  if (!queue) {
    await interaction.reply(ephemeral(pick(messages.nothingPlaying)));
    return;
  }

  queue.delete();
  await interaction.reply({ content: pick(messages.stopped), flags: MessageFlags.Ephemeral });
}
