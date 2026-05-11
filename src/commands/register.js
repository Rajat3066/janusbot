const { SlashCommandBuilder } = require('discord.js');
const db = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register Gov and Opp roles for JanusBot')
    .addRoleOption(option =>
      option.setName('gov')
        .setDescription('The Government role')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('opp')
        .setDescription('The Opposition role')
        .setRequired(true)),

  async execute(interaction) {
    const govRole = interaction.options.getRole('gov');
    const oppRole = interaction.options.getRole('opp');
    const guildId = interaction.guildId;

    db.prepare(`
      CREATE TABLE IF NOT EXISTS roles (
        guild_id TEXT PRIMARY KEY,
        gov_role_id TEXT,
        opp_role_id TEXT
      )
    `).run();

    db.prepare(`
      INSERT INTO roles (guild_id, gov_role_id, opp_role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        gov_role_id = excluded.gov_role_id,
        opp_role_id = excluded.opp_role_id
    `).run(guildId, govRole.id, oppRole.id);

    await interaction.reply({
      content: `Roles registered. Government: ${govRole} | Opposition: ${oppRole}`,
      ephemeral: true
    });
  }
};