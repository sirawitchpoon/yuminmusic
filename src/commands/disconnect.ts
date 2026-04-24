import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { useQueue } from "discord-player";
import { isAdmin } from "../auth/roles.js";
import { pick, messages } from "../ui/messages.js";

export const disconnectCommand = {
  data: new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("บังคับให้ยุยออกจาก voice (admin เท่านั้น)")
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember | null;
    if (!member || !isAdmin(member)) {
      await interaction.reply({ content: pick(messages.notAuthorized), ephemeral: true });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({ content: "ต้องรันในเซิร์ฟเวอร์ค่ะ", ephemeral: true });
      return;
    }

    const queue = useQueue(interaction.guildId);
    if (!queue) {
      await interaction.reply({ content: "ยุยไม่ได้อยู่ใน voice อยู่แล้วค่า~", ephemeral: true });
      return;
    }

    queue.delete();
    await interaction.reply({ content: pick(messages.disconnected), ephemeral: false });
  },
};
