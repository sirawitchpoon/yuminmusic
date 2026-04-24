import {
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { setupCommand } from "./setup.js";
import { reloadCommand } from "./reload.js";
import { disconnectCommand } from "./disconnect.js";

interface SlashCommand {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands: Record<string, SlashCommand> = {
  setup: setupCommand,
  reload: reloadCommand,
  disconnect: disconnectCommand,
};

export async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const body = Object.values(commands).map((c) => c.data);
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.GUILD_ID),
      { body },
    );
    logger.info({ count: body.length }, "slash commands registered");
  } catch (err) {
    logger.error({ err }, "failed to register slash commands");
    throw err;
  }
}

export async function handleChatInput(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = commands[interaction.commandName];
  if (!command) {
    await interaction.reply({ content: "ไม่รู้จักคำสั่งนี้ค่ะ~", ephemeral: true });
    return;
  }
  await command.execute(interaction);
}
