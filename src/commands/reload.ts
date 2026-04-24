import {
  ChannelType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { isAdmin } from "../auth/roles.js";
import { buildPanelPayload } from "../ui/panel.js";
import { pick, messages } from "../ui/messages.js";

export const reloadCommand = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("สร้าง panel ใหม่ในช่องนี้ (admin เท่านั้น)")
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember | null;
    if (!member || !isAdmin(member)) {
      await interaction.reply({ content: pick(messages.notAuthorized), ephemeral: true });
      return;
    }

    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "ต้องรันในช่อง text ปกติเท่านั้นค่ะ~",
        ephemeral: true,
      });
      return;
    }

    const payload = buildPanelPayload();
    await interaction.channel.send(payload);
    await interaction.reply({
      content: "สร้าง panel ใหม่ให้แล้วค่า~ ✨",
      ephemeral: true,
    });
  },
};
