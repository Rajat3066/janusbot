const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('startround')
    .setDescription('Start a new round and send motions to Gov and Opp')
    .addStringOption(option =>
      option.setName('motion1')
        .setDescription('First motion')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('motion2')
        .setDescription('Second motion')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('motion3')
        .setDescription('Third motion')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    
    const motion1 = interaction.options.getString('motion1');
    const motion2 = interaction.options.getString('motion2');
    const motion3 = interaction.options.getString('motion3');
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    const axios = require('axios');
    const { fetchDraw } = require('../handlers/tabbycatApi');

    let settings;
    try {
      const res = await axios.get(`${process.env.APPS_SCRIPT_URL}?page=bot`);
      settings = res.data;
    } catch (err) {
      return interaction.editReply('Could not fetch settings from dashboard. Make sure your Apps Script is deployed.');
    }

    const { tabbycat_url, tabbycat_token, tournament_slug } = settings;
    if (!tabbycat_url || !tabbycat_token || !tournament_slug) {
      return interaction.editReply('Missing Tabbycat URL, token or tournament slug in dashboard settings.');
    }

    let draw;
    try {
      const roundRes = await axios.get(
        `${tabbycat_url}/api/v1/tournaments/${tournament_slug}/rounds`,
        { headers: { Authorization: `Token ${tabbycat_token}` } }
      );
      const currentRound = roundRes.data.find(r => r.completed === false);
      const roundNumber = currentRound ? currentRound.seq : 1;

      draw = await fetchDraw(tabbycat_url, tabbycat_token, tournament_slug, roundNumber);
    } catch (err) {
      console.error(err);
      return interaction.editReply('Could not fetch draw from Tabbycat. Check your URL and token in dashboard settings.');
    }

    let teamsData;
    try {
      const res = await axios.get(`${process.env.APPS_SCRIPT_URL}?page=bot`);
      teamsData = res.data;
    } catch (err) {
      return interaction.editReply('Could not fetch team data from dashboard.');
    }

    const { fetchTeams } = require('../handlers/teamsHelper');
    const teamDiscordMap = await fetchTeams(process.env.APPS_SCRIPT_URL);

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const motionText = `**Motions for this round:**\n1. ${motion1}\n2. ${motion2}\n3. ${motion3}\n\nPlease submit:\n**Preference:** Which motion do you want? (1, 2 or 3)\n**Veto:** Which motion do you NOT want? (1, 2 or 3)`;

    let sent = 0;

    for (const room of draw) {
      const govDiscord = teamDiscordMap[room.gov];
      const oppDiscord = teamDiscordMap[room.opp];

      db.prepare(`
        INSERT INTO rounds (guild_id, channel_id, motion1, motion2, motion3, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(guildId, channelId, motion1, motion2, motion3);

      const round = db.prepare('SELECT * FROM rounds WHERE guild_id = ? ORDER BY id DESC LIMIT 1').get(guildId);

      const govRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pref_${round.id}_gov_1`).setLabel('Pref 1').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`pref_${round.id}_gov_2`).setLabel('Pref 2').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`pref_${round.id}_gov_3`).setLabel('Pref 3').setStyle(ButtonStyle.Primary),
      );

      const oppRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pref_${round.id}_opp_1`).setLabel('Pref 1').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`pref_${round.id}_opp_2`).setLabel('Pref 2').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`pref_${round.id}_opp_3`).setLabel('Pref 3').setStyle(ButtonStyle.Primary),
      );

      if (govDiscord) {
        try {
          const govUser = await interaction.client.users.fetch(govDiscord.id1);
          await govUser.send({ content: `**Room: ${room.room}**\nYou are: **Government**\n\n${motionText}`, components: [govRow] });
          sent++;
        } catch(e) { console.error(`Could not DM gov team ${room.gov}`, e); }
      }

      if (oppDiscord) {
        try {
          const oppUser = await interaction.client.users.fetch(oppDiscord.id1);
          await oppUser.send({ content: `**Room: ${room.room}**\nYou are: **Opposition**\n\n${motionText}`, components: [oppRow] });
          sent++;
        } catch(e) { console.error(`Could not DM opp team ${room.opp}`, e); }
      }

      setTimeout(async () => {
        const { resolveMotion } = require('../handlers/motionResolver');
        await resolveMotion(interaction, round.id);
      }, 5 * 60 * 1000);
    }

    await interaction.editReply(`Round started! Motions sent to ${sent} teams across ${draw.length} rooms.`);
  }
};