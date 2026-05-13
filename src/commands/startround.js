const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db/database');

module.exports = {
data: new SlashCommandBuilder()
  .setName('startround')
  .setDescription('Start a new round, fetch draw and motions from Tabbycat automatically'),

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
    let motions;
    let currentRoundNumber = 1;
    try {
      const roundRes = await axios.get(
        `${tabbycat_url.replace(/\/$/, '')}/api/v1/tournaments/${tournament_slug}/rounds`,
        { headers: { Authorization: `Token ${tabbycat_token}`, Accept: 'application/json' } }
      );
      const currentRound = roundRes.data.find(r => r.completed === false);
      const roundNumber = currentRound ? currentRound.seq : 1;
      currentRoundNumber = roundNumber;

      const result = await fetchDraw(tabbycat_url, tabbycat_token, tournament_slug, roundNumber);
      draw = result.draw;
      motions = result.motions;
    } catch (err) {
      console.error(err);
      return interaction.editReply('Could not fetch draw from Tabbycat. Check your URL and token in dashboard settings.');
    }

    let teamsData;
    try {
      const res = await axios.get(`${process.env.APPS_SCRIPT_URL}?page=bot`, { maxRedirects: 5, headers: { Accept: 'application/json' } });
settings = res.data;
    } catch (err) {
      return interaction.editReply('Could not fetch team data from dashboard.');
    }

    const { fetchTeams } = require('../handlers/teamsHelper');
    const teamDiscordMap = await fetchTeams(process.env.APPS_SCRIPT_URL);
    console.log('Team Discord Map:', JSON.stringify(teamDiscordMap));
    console.log('Draw:', JSON.stringify(draw));

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const motionText = `**Round ${currentRoundNumber} Motions:**\n1. ${motions[0]?.text || 'TBA'}\n2. ${motions[1]?.text || 'TBA'}\n3. ${motions[2]?.text || 'TBA'}\n\nPlease submit:\n**Preference:** Which motion do you want? (1, 2 or 3)\n**Veto:** Which motion do you NOT want? (1, 2 or 3)`;

    let sent = 0;

    for (const room of draw) {
      const govDiscord = teamDiscordMap[room.gov];
      const oppDiscord = teamDiscordMap[room.opp];

      db.prepare(`
        INSERT INTO rounds (guild_id, channel_id, room_name, round_number, motion1, motion2, motion3, infoslide1, infoslide2, infoslide3, started_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        guildId, channelId, room.room, currentRoundNumber,
        motions[0]?.text || '', motions[1]?.text || '', motions[2]?.text || '',
        motions[0]?.info_slide || '', motions[1]?.info_slide || '', motions[2]?.info_slide || '',
        Date.now()
      );
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

      let govUserId = null;
      let oppUserId = null;

      if (govDiscord) {
        try {
          const govUser = await interaction.client.users.fetch(govDiscord.id1);
          govUserId = govUser.id;
          const deadline = new Date(Date.now() + 5 * 60 * 1000);
          const deadlineStr = deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await govUser.send({ 
            content: `**Room: ${room.room} | Round ${currentRoundNumber}**\nYou are: **Government**\n\n${motionText}\n\n⏰ Submit before **${deadlineStr}**`, 
            components: [govRow] 
          });
          sent++;
        } catch(e) { console.error(`Could not DM gov team ${room.gov}`, e); }
      }

      if (oppDiscord) {
        try {
          const oppUser = await interaction.client.users.fetch(oppDiscord.id1);
          oppUserId = oppUser.id;
          const deadline = new Date(Date.now() + 5 * 60 * 1000);
          const deadlineStr = deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await oppUser.send({ 
            content: `**Room: ${room.room} | Round ${currentRoundNumber}**\nYou are: **Opposition**\n\n${motionText}\n\n⏰ Submit before **${deadlineStr}**`, 
            components: [oppRow] 
          });
          sent++;
        } catch(e) { console.error(`Could not DM opp team ${room.opp}`, e); }
      }

      db.prepare('UPDATE rounds SET gov_discord_id = ?, opp_discord_id = ? WHERE id = ?').run(govUserId, oppUserId, round.id);

      setTimeout(async () => {
        const updatedRound = db.prepare('SELECT * FROM rounds WHERE id = ?').get(round.id);
        if (updatedRound.status !== 'pending') return;

        if (!updatedRound.gov_ranking || !updatedRound.gov_veto) {
          if (govUserId) {
            try {
              const govUser = await interaction.client.users.fetch(govUserId);
              await govUser.send(`⚠️ **1 minute left!** Room: ${room.room} | You haven't submitted your preference and veto yet. Please do it now!`);
            } catch(e) { console.error('Could not send reminder to gov', e); }
          }
        }

        if (!updatedRound.opp_ranking || !updatedRound.opp_veto) {
          if (oppUserId) {
            try {
              const oppUser = await interaction.client.users.fetch(oppUserId);
              await oppUser.send(`⚠️ **1 minute left!** Room: ${room.room} | You haven't submitted your preference and veto yet. Please do it now!`);
            } catch(e) { console.error('Could not send reminder to opp', e); }
          }
        }
      }, 4 * 60 * 1000);

      setTimeout(async () => {
        const { resolveMotion } = require('../handlers/motionResolver');
        await resolveMotion(interaction, round.id);
      }, 5 * 60 * 1000);
    }

    await interaction.editReply(`Round started! Motions sent to ${sent} teams across ${draw.length} rooms.`);
  }
};