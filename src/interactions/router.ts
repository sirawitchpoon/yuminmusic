import { type Interaction, MessageFlags } from "discord.js";
import { handleChatInput } from "../commands/index.js";
import { handleButton } from "./buttons.js";
import { handleModal } from "./modals.js";
import { logger } from "../logger.js";

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInput(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }
  } catch (err) {
    logger.error({ err, customId: "customId" in interaction ? interaction.customId : undefined }, "interaction error");
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "อ้าว~ ยุยเจอ error ค่ะ ขอโทษน้า 😢",
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        // ignore
      }
    }
  }
}
