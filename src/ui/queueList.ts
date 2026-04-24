import { EmbedBuilder } from "discord.js";
import type { GuildQueue } from "discord-player";

const MAX_DISPLAY = 10;

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function buildQueueEmbed(queue: GuildQueue): EmbedBuilder {
  const current = queue.currentTrack;
  const tracks = queue.tracks.toArray();

  const embed = new EmbedBuilder()
    .setColor(0xffb3d9)
    .setTitle("📜 คิวเพลง");

  if (current) {
    embed.addFields({
      name: "🎵 กำลังเล่น",
      value: `**${current.title}**\nโดย ${current.author} · \`${formatDuration(current.durationMS)}\``,
    });
  }

  if (tracks.length === 0) {
    embed.setDescription(current ? "ไม่มีเพลงรอในคิวค่ะ" : "คิวว่างเลยค่ะ~ กด ▶️ เพิ่มเพลงได้เลยน้า");
    return embed;
  }

  const display = tracks.slice(0, MAX_DISPLAY);
  const lines = display.map(
    (t, i) =>
      `\`${(i + 1).toString().padStart(2, "0")}.\` **${t.title}** — ${t.author} \`${formatDuration(t.durationMS)}\``,
  );

  embed.addFields({
    name: `ถัดไป (${tracks.length} เพลง)`,
    value: lines.join("\n"),
  });

  if (tracks.length > MAX_DISPLAY) {
    embed.setFooter({ text: `และอีก ${tracks.length - MAX_DISPLAY} เพลง...` });
  }

  return embed;
}
