import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { config } from "../config.js";

export function isAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (config.ADMIN_ROLE_ID && member.roles.cache.has(config.ADMIN_ROLE_ID)) return true;
  return false;
}

export function isDJ(member: GuildMember): boolean {
  if (isAdmin(member)) return true;
  if (config.DJ_ROLE_ID && member.roles.cache.has(config.DJ_ROLE_ID)) return true;
  return false;
}
