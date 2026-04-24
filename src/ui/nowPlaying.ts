import { EmbedBuilder } from "discord.js";
import type { GuildQueue, Track } from "discord-player";

function formatRequester(track: Track): string {
  const r = track.requestedBy;
  if (!r) return "ไม่ระบุ";
  return `<@${r.id}>`;
}

function progressBar(position: number, total: number, length = 18): string {
  if (!total || total <= 0) return "▬".repeat(length);
  const ratio = Math.max(0, Math.min(1, position / total));
  const knobIndex = Math.floor(ratio * (length - 1));
  let bar = "";
  for (let i = 0; i < length; i++) {
    bar += i === knobIndex ? "🔘" : "▬";
  }
  return bar;
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function buildNowPlayingEmbed(track: Track, queue: GuildQueue): EmbedBuilder {
  const durationMs = track.durationMS || 0;
  const position = queue.node.getTimestamp()?.current.value ?? 0;
  const bar = progressBar(position, durationMs);

  const upNext = queue.tracks.at(0);
  const fields = [
    {
      name: "⏱️ เวลา",
      value: `\`${formatTime(position)}\` ${bar} \`${formatTime(durationMs)}\``,
    },
    {
      name: "🎤 ศิลปิน",
      value: track.author || "—",
      inline: true,
    },
    {
      name: "🙋 ขอโดย",
      value: formatRequester(track),
      inline: true,
    },
  ];

  if (upNext) {
    fields.push({
      name: "⏭️ เพลงถัดไป",
      value: `${upNext.title} — ${upNext.author}`,
      inline: false,
    });
  }

  return new EmbedBuilder()
    .setColor(0xffb3d9)
    .setAuthor({ name: "🎵 กำลังเล่น" })
    .setTitle(track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail || null)
    .addFields(fields)
    .setFooter({ text: "ยุยกำลังฟังกับคุณอยู่นะคะ 🎵" });
}

export function buildQueueEndedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xcccccc)
    .setDescription("คิวว่างแล้วค่ะ~ ถ้าเงียบนานยุยจะออกจาก voice เองน้า 💤");
}
