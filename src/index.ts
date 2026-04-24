import { Events } from "discord.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createClient } from "./client.js";
import { createPlayer, registerPlayerEvents } from "./player/index.js";
import { registerCommands } from "./commands/index.js";
import { handleInteraction } from "./interactions/router.js";

async function main(): Promise<void> {
  const client = createClient();
  const player = await createPlayer(client);
  registerPlayerEvents(player);

  client.once(Events.ClientReady, (c) => {
    logger.info({ tag: c.user.tag, id: c.user.id }, "ยุยพร้อมเล่นเพลงแล้วค่ะ~ 🎵");
  });

  client.on(Events.InteractionCreate, (interaction) => {
    handleInteraction(interaction).catch((err) => {
      logger.error({ err }, "interaction handler failed");
    });
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "discord client error");
  });

  await registerCommands();
  await client.login(config.DISCORD_TOKEN);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down...");
    try {
      for (const queue of player.nodes.cache.values()) {
        queue.delete();
      }
      await client.destroy();
    } catch (err) {
      logger.error({ err }, "error during shutdown");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, "fatal bootstrap error");
  process.exit(1);
});
