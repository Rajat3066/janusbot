const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Register yourself as a team member using your Tabbycat private URL'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('join_modal')
      .setTitle('Register with JanusBot');

    const urlInput = new TextInputBuilder()
      .setCustomId('private_url')
      .setLabel('Paste your Tabbycat private URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://yourtournament.com/JH22/privateurls/xxxxxxxx/')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
    await interaction.showModal(modal);
  }
};