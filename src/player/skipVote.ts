import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type GuildMember,
  type TextBasedChannel,
} from "discord.js";
import type { GuildQueue, Track } from "discord-player";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { isAdmin, isDJ } from "../auth/roles.js";
import { pick, messages } from "../ui/messages.js";

const VOTE_DURATION_MS = 60_000;

interface SkipVoteState {
  trackId: string;
  voters: Set<string>;
  needed: number;
  messageId: string;
  channelId: string;
  timer: NodeJS.Timeout;
}

const activeVotes = new Map<string, SkipVoteState>();

function countEligibleListeners(queue: GuildQueue): number {
  const voiceChannel = queue.channel;
  if (!voiceChannel) return 0;
  return voiceChannel.members.filter((m) => !m.user.bot).size;
}

function computeNeeded(listeners: number): number {
  if (listeners <= 1) return 1;
  return Math.max(1, Math.ceil(listeners * config.SKIP_VOTE_RATIO));
}

function hasForceSkipPower(member: GuildMember, track: Track | null): boolean {
  if (isAdmin(member) || isDJ(member)) return true;
  if (track && track.requestedBy && track.requestedBy.id === member.id) return true;
  return false;
}

function buildVoteEmbed(track: Track, voters: number, needed: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xffb3d9)
    .setTitle("🗳️ โหวตข้ามเพลง")
    .setDescription(`**${track.title}**\nโดย ${track.author}`)
    .addFields({
      name: "โหวตแล้ว",
      value: `**${voters} / ${needed}**`,
    })
    .setFooter({ text: "หมดเวลาใน 60 วินาที" });
}

function buildVoteButton(trackId: string, voters: number, needed: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ym:vote:skip:${trackId}`)
      .setLabel(`โหวตข้าม (${voters}/${needed})`)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Primary),
  );
}

async function finalizeSkip(
  queue: GuildQueue,
  state: SkipVoteState,
  channel: TextBasedChannel,
  reason: "passed" | "expired" | "forced",
): Promise<void> {
  clearTimeout(state.timer);
  activeVotes.delete(queue.guild.id);

  if (channel.isSendable() && state.messageId) {
    try {
      const msg = await channel.messages.fetch(state.messageId);
      if (reason === "passed") {
        await msg.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0xb3ffb3)
              .setDescription(`✅ โหวตผ่าน — ยุยข้ามเพลงให้แล้วน้า~`),
          ],
          components: [],
        });
      } else if (reason === "expired") {
        await msg.edit({
          embeds: [
            new EmbedBuilder().setColor(0xcccccc).setDescription(pick(messages.voteFailed)),
          ],
          components: [],
        });
      } else {
        await msg.delete().catch(() => {});
      }
    } catch (err) {
      logger.debug({ err }, "vote cleanup message missing");
    }
  }
}

export async function initiateSkipVote(
  interaction: ButtonInteraction,
  queue: GuildQueue,
): Promise<void> {
  const currentTrack = queue.currentTrack;
  if (!currentTrack) {
    await interaction.reply({
      content: pick(messages.nothingPlaying),
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;

  if (hasForceSkipPower(member, currentTrack)) {
    queue.node.skip();
    const existing = activeVotes.get(queue.guild.id);
    if (existing && interaction.channel) {
      await finalizeSkip(queue, existing, interaction.channel, "forced");
    }
    await interaction.reply({
      content: `⏭️ ${member.displayName} ข้ามเพลง **${currentTrack.title}** แล้ว`,
      ephemeral: false,
    });
    return;
  }

  const listeners = countEligibleListeners(queue);
  const needed = computeNeeded(listeners);

  if (needed <= 1) {
    queue.node.skip();
    await interaction.reply({
      content: `⏭️ ยุยข้ามเพลง **${currentTrack.title}** ให้เลยค่ะ~`,
      ephemeral: false,
    });
    return;
  }

  let state = activeVotes.get(queue.guild.id);

  if (!state || state.trackId !== currentTrack.id) {
    if (state && interaction.channel) {
      await finalizeSkip(queue, state, interaction.channel, "forced");
    }

    if (!interaction.channel?.isSendable()) {
      await interaction.reply({
        content: "ช่องนี้ยุยส่งข้อความไม่ได้ค่ะ",
        ephemeral: true,
      });
      return;
    }

    const voters = new Set<string>([member.id]);
    const embed = buildVoteEmbed(currentTrack, voters.size, needed);
    const button = buildVoteButton(currentTrack.id, voters.size, needed);

    const msg = await interaction.channel.send({ embeds: [embed], components: [button] });
    const timer = setTimeout(() => {
      const s = activeVotes.get(queue.guild.id);
      if (s && s.trackId === currentTrack.id && interaction.channel) {
        void finalizeSkip(queue, s, interaction.channel, "expired");
      }
    }, VOTE_DURATION_MS);

    state = {
      trackId: currentTrack.id,
      voters,
      needed,
      messageId: msg.id,
      channelId: interaction.channel.id,
      timer,
    };
    activeVotes.set(queue.guild.id, state);

    await interaction.reply({
      content: pick(messages.voteStarted),
      ephemeral: true,
    });
    return;
  }

  if (state.voters.has(member.id)) {
    await interaction.reply({
      content: "โหวตไปแล้วนะคะ~ รอเพื่อน ๆ อีกหน่อยน้า 💕",
      ephemeral: true,
    });
    return;
  }

  state.voters.add(member.id);
  await interaction.deferUpdate().catch(() => {});

  if (state.voters.size >= state.needed) {
    if (interaction.channel) {
      await finalizeSkip(queue, state, interaction.channel, "passed");
    }
    queue.node.skip();
    return;
  }

  if (interaction.channel?.isSendable()) {
    try {
      const msg = await interaction.channel.messages.fetch(state.messageId);
      await msg.edit({
        embeds: [buildVoteEmbed(currentTrack, state.voters.size, state.needed)],
        components: [buildVoteButton(currentTrack.id, state.voters.size, state.needed)],
      });
    } catch (err) {
      logger.warn({ err }, "failed to update vote message");
    }
  }
}

export async function handleVoteButton(
  interaction: ButtonInteraction,
  queue: GuildQueue,
  trackId: string,
): Promise<void> {
  const currentTrack = queue.currentTrack;
  if (!currentTrack || currentTrack.id !== trackId) {
    await interaction.reply({
      content: "เพลงนี้ผ่านไปแล้วค่ะ~",
      ephemeral: true,
    });
    return;
  }

  const state = activeVotes.get(queue.guild.id);
  if (!state || state.trackId !== trackId) {
    await interaction.reply({
      content: "โหวตนี้ปิดแล้วค่ะ",
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  if (state.voters.has(member.id)) {
    await interaction.reply({
      content: "โหวตไปแล้วนะคะ~",
      ephemeral: true,
    });
    return;
  }

  state.voters.add(member.id);
  await interaction.deferUpdate().catch(() => {});

  if (state.voters.size >= state.needed) {
    if (interaction.channel) {
      await finalizeSkip(queue, state, interaction.channel, "passed");
    }
    queue.node.skip();
    return;
  }

  if (interaction.channel?.isSendable()) {
    try {
      const msg = await interaction.channel.messages.fetch(state.messageId);
      await msg.edit({
        embeds: [buildVoteEmbed(currentTrack, state.voters.size, state.needed)],
        components: [buildVoteButton(trackId, state.voters.size, state.needed)],
      });
    } catch (err) {
      logger.warn({ err }, "failed to update vote message from vote button");
    }
  }
}

export function cleanupVote(guildId: string): void {
  const state = activeVotes.get(guildId);
  if (state) {
    clearTimeout(state.timer);
    activeVotes.delete(guildId);
  }
}
