import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
} from "discord.js";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { config } from "../config.js";
import { logger } from "../logger.js";

export interface PanelPayload {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
  files: AttachmentBuilder[];
}

export function buildControlRow1(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ym:play")
      .setEmoji("▶️")
      .setLabel("เล่นเพลง")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ym:pause")
      .setEmoji("⏸️")
      .setLabel("หยุดชั่วคราว")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ym:skip")
      .setEmoji("⏭️")
      .setLabel("ข้ามเพลง")
      .setStyle(ButtonStyle.Primary),
  );
}

export function buildControlRow2(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ym:queue")
      .setEmoji("📜")
      .setLabel("คิว")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ym:loop")
      .setEmoji("🔁")
      .setLabel("ลูป")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ym:stop")
      .setEmoji("🛑")
      .setLabel("หยุด")
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPanelPayload(): BaseMessageOptions {
  const files: AttachmentBuilder[] = [];
  const embed = new EmbedBuilder()
    .setColor(0xffb3d9)
    .setTitle("🎵 yuminmusic — ห้องเพลงของยุย")
    .setDescription(
      [
        "สวัสดีค่าา~ ยุยเป็น music bot ประจำเซิร์ฟเวอร์นี้เองค่ะ 💕",
        "",
        "**วิธีใช้งาน**",
        "1. เข้า voice channel ก่อนน้า",
        "2. กด ▶️ **เล่นเพลง** แล้ววาง YouTube / Spotify / SoundCloud URL หรือพิมพ์ชื่อเพลงก็ได้",
        "3. ปุ่มอื่น ๆ ใช้คุม pause / skip / ดูคิว / loop",
        "",
        "ข้ามเพลงใช้โหวตค่ะ (admin/DJ/คนขอ ข้ามได้ทันที)",
      ].join("\n"),
    )
    .setFooter({ text: "ยุยรออยู่นะคะ~ 🐾" });

  if (existsSync(config.PANEL_BANNER_PATH)) {
    const name = basename(config.PANEL_BANNER_PATH);
    files.push(new AttachmentBuilder(config.PANEL_BANNER_PATH, { name }));
    embed.setImage(`attachment://${name}`);
  } else {
    logger.warn(
      { path: config.PANEL_BANNER_PATH },
      "panel banner file missing — posting without image",
    );
  }

  if (existsSync(config.PANEL_GIF_PATH)) {
    const name = basename(config.PANEL_GIF_PATH);
    files.push(new AttachmentBuilder(config.PANEL_GIF_PATH, { name }));
    embed.setThumbnail(`attachment://${name}`);
  }

  return {
    embeds: [embed],
    components: [buildControlRow1(), buildControlRow2()],
    files,
  };
}
