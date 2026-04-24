import { MessageFlags, type GuildMember, type ModalSubmitInteraction } from "discord.js";
import { useMainPlayer, QueryType } from "discord-player";
import { logger } from "../logger.js";
import { config } from "../config.js";
import { pick, messages } from "../ui/messages.js";
import type { QueueMetadata } from "../player/events.js";

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== "ym:modal:addTrack") return;
  await handleAddTrack(interaction);
}

async function handleAddTrack(interaction: ModalSubmitInteraction): Promise<void> {
  const query = interaction.fields.getTextInputValue("query").trim();
  if (!query) {
    await interaction.reply({
      content: "วางลิงก์หรือชื่อเพลงก่อนน้า~",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.member as GuildMember | null;
  const voiceChannel = member?.voice.channel ?? null;
  if (!voiceChannel || !interaction.guildId) {
    await interaction.reply({
      content: pick(messages.notInVoice),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const player = useMainPlayer();

  try {
    const metadata: QueueMetadata = { channel: interaction.channel ?? voiceChannel };
    const { track } = await player.play(voiceChannel, query, {
      requestedBy: interaction.user,
      searchEngine: QueryType.AUTO,
      nodeOptions: {
        metadata,
        volume: config.DEFAULT_VOLUME,
        leaveOnEmpty: false,
        leaveOnEnd: false,
        leaveOnStop: false,
        selfDeaf: true,
        bufferingTimeout: 15_000,
      },
    });

    await interaction.editReply({
      content: `${pick(messages.trackAdded)}\n**${track.title}** — ${track.author}`,
    });
  } catch (err) {
    logger.warn({ err, query }, "play failed");
    await interaction.editReply({
      content: pick(messages.searchFailed),
    });
  }
}
