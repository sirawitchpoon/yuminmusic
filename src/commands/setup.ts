import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { isAdmin } from "../auth/roles.js";
import { buildPanelPayload } from "../ui/panel.js";
import { pick, messages } from "../ui/messages.js";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("วาง panel ควบคุมเพลงในช่องนี้ (admin เท่านั้น)")
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const payload = buildPanelPayload();
    await interaction.channel.send(payload);
    await interaction.editReply({
      content: "วาง panel ให้แล้วน้า~ 💕 (ลบข้อความ panel เก่าด้วยมือถ้าไม่ใช้แล้วค่ะ)",
    });
  },
};
