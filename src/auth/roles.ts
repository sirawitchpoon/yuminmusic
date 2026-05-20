import { PermissionFlagsBits, type GuildMember } from "discord.js";

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}
