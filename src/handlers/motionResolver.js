const db = require('../db/database');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function handleButton(interaction) {
  const parts = interaction.customId.split('_');
  const type = parts[0];
  const roundId = parts[1];
  const side = parts[2];
  const motionIndex = parts[3];

  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round || round.status !== 'pending') {
    return interaction.reply({ content: 'This round is no longer active.', ephemeral: true });
  }

  if (type === 'pref') {
    if (side === 'gov') {
      if (round.gov_ranking) {
        return interaction.reply({ content: 'Government has already submitted their preference.', ephemeral: true });
      }
      db.prepare('UPDATE rounds SET gov_ranking = ? WHERE id = ?').run(motionIndex, roundId);
      await interaction.reply({ 
        content: `Preference recorded as Motion ${motionIndex}. Now select your veto.`, 
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`veto_${roundId}_gov_1`).setLabel('Veto 1').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`veto_${roundId}_gov_2`).setLabel('Veto 2').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`veto_${roundId}_gov_3`).setLabel('Veto 3').setStyle(ButtonStyle.Danger),
        )]
      });
    }

    if (side === 'opp') {
      if (round.opp_ranking) {
        return interaction.reply({ content: 'Opposition has already submitted their preference.', ephemeral: true });
      }
      db.prepare('UPDATE rounds SET opp_ranking = ? WHERE id = ?').run(motionIndex, roundId);
      await interaction.reply({ 
        content: `Preference recorded as Motion ${motionIndex}. Now select your veto.`, 
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`veto_${roundId}_opp_1`).setLabel('Veto 1').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`veto_${roundId}_opp_2`).setLabel('Veto 2').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`veto_${roundId}_opp_3`).setLabel('Veto 3').setStyle(ButtonStyle.Danger),
        )]
      });
    }
  }

  if (type === 'veto') {
    if (side === 'gov') {
      if (round.gov_veto) {
        return interaction.reply({ content: 'Government has already submitted their veto.', ephemeral: true });
      }
      const govPref = parseInt(round.gov_ranking);
      const vetoVal = parseInt(motionIndex);
      if (govPref === vetoVal) {
        return interaction.reply({
          content: 'Your preference and veto cannot be the same motion. Please select a different veto.',
          ephemeral: true,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`veto_${roundId}_gov_1`).setLabel('Veto 1').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`veto_${roundId}_gov_2`).setLabel('Veto 2').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`veto_${roundId}_gov_3`).setLabel('Veto 3').setStyle(ButtonStyle.Danger),
          )]
        });
      }
      db.prepare('UPDATE rounds SET gov_veto = ? WHERE id = ?').run(motionIndex, roundId);

      const timeLeft = (round.started_at + 5 * 60 * 1000) - Date.now();
      const allowChange = timeLeft > 35 * 1000;
      console.log('createdAt:', round.created_at, 'timeLeft:', timeLeft, 'allowChange:', allowChange);

      await interaction.reply({
        content: `Your submission:\n**Preference:** Motion ${round.gov_ranking}\n**Veto:** Motion ${motionIndex}\n\n${allowChange ? 'You have 30 seconds to change your vote.' : 'Vote locked.'}`,
        ephemeral: true,
        components: allowChange ? [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`change_${roundId}_gov`).setLabel('Change Vote').setStyle(ButtonStyle.Secondary)
        )] : []
      });

      if (allowChange) {
        setTimeout(async () => {
          try {
            await interaction.editReply({
              content: `Your final submission:\n**Preference:** Motion ${round.gov_ranking}\n**Veto:** Motion ${motionIndex}\n\nVote is now locked.`,
              components: []
            });
          } catch(e) { console.error('Could not edit gov reply', e); }

          const latest = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
          if (latest.status !== 'pending') return;
          if (latest.gov_ranking && latest.gov_veto && latest.opp_ranking && latest.opp_veto) {
            await resolveMotion(interaction, roundId);
          }
        }, 30 * 1000);
      }
    }

    if (side === 'opp') {
      if (round.opp_veto) {
        return interaction.reply({ content: 'Opposition has already submitted their veto.', ephemeral: true });
      }
      const oppPref = parseInt(round.opp_ranking);
      const vetoVal = parseInt(motionIndex);
      if (oppPref === vetoVal) {
        return interaction.reply({
          content: 'Your preference and veto cannot be the same motion. Please select a different veto.',
          ephemeral: true,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`veto_${roundId}_opp_1`).setLabel('Veto 1').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`veto_${roundId}_opp_2`).setLabel('Veto 2').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`veto_${roundId}_opp_3`).setLabel('Veto 3').setStyle(ButtonStyle.Danger),
          )]
        });
      }
      db.prepare('UPDATE rounds SET opp_veto = ? WHERE id = ?').run(motionIndex, roundId);

      const timeLeft = (round.started_at + 5 * 60 * 1000) - Date.now();
      const allowChange = timeLeft > 35 * 1000;
      console.log('createdAt:', round.created_at, 'timeLeft:', timeLeft, 'allowChange:', allowChange);


      await interaction.reply({
        content: `Your submission:\n**Preference:** Motion ${round.opp_ranking}\n**Veto:** Motion ${motionIndex}\n\n${allowChange ? 'You have 30 seconds to change your vote.' : 'Vote locked.'}`,
        ephemeral: true,
        components: allowChange ? [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`change_${roundId}_opp`).setLabel('Change Vote').setStyle(ButtonStyle.Secondary)
        )] : []
      });

      if (allowChange) {
        setTimeout(async () => {
          try {
            await interaction.editReply({
              content: `Your final submission:\n**Preference:** Motion ${round.opp_ranking}\n**Veto:** Motion ${motionIndex}\n\nVote is now locked.`,
              components: []
            });
          } catch(e) { console.error('Could not edit opp reply', e); }

          const latest = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
          if (latest.status !== 'pending') return;
          if (latest.gov_ranking && latest.gov_veto && latest.opp_ranking && latest.opp_veto) {
            await resolveMotion(interaction, roundId);
          }
        }, 30 * 1000);
      }
    }
  }
  
  if (type === 'change') {
    if (side === 'gov') {
      db.prepare('UPDATE rounds SET gov_ranking = NULL, gov_veto = NULL WHERE id = ?').run(roundId);
      return interaction.reply({
        content: 'Vote cleared. Please resubmit your preference and veto.',
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`pref_${roundId}_gov_1`).setLabel('Pref 1').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`pref_${roundId}_gov_2`).setLabel('Pref 2').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`pref_${roundId}_gov_3`).setLabel('Pref 3').setStyle(ButtonStyle.Primary),
        )]
      });
    }
    if (side === 'opp') {
      db.prepare('UPDATE rounds SET opp_ranking = NULL, opp_veto = NULL WHERE id = ?').run(roundId);
      return interaction.reply({
        content: 'Vote cleared. Please resubmit your preference and veto.',
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`pref_${roundId}_opp_1`).setLabel('Pref 1').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`pref_${roundId}_opp_2`).setLabel('Pref 2').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`pref_${roundId}_opp_3`).setLabel('Pref 3').setStyle(ButtonStyle.Primary),
        )]
      });
    }
  }

  const updated = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (updated.gov_ranking && updated.gov_veto && updated.opp_ranking && updated.opp_veto) {
    await resolveMotion(interaction, roundId);
  }
}

async function resolveMotion(interaction, roundId) {
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(roundId);
  if (!round || round.status !== 'pending') return;

  db.prepare('UPDATE rounds SET status = ? WHERE id = ?').run('resolved', roundId);

  const motions = [round.motion1, round.motion2, round.motion3];
  const infoslides = [round.infoslide1, round.infoslide2, round.infoslide3];
  const all = [1, 2, 3];

  let result;
  let reason;
  let motionNumber;

  const govPref = round.gov_ranking ? parseInt(round.gov_ranking) : null;
  const oppPref = round.opp_ranking ? parseInt(round.opp_ranking) : null;
  const govVeto = round.gov_veto ? parseInt(round.gov_veto) : null;
  const oppVeto = round.opp_veto ? parseInt(round.opp_veto) : null;

  if (!govPref && !oppPref) {
    motionNumber = Math.floor(Math.random() * 3) + 1;
    reason = 'Neither team submitted. Coin toss decided the motion.';
  } else if (!govPref) {
    motionNumber = oppPref;
    reason = 'Only Opposition submitted. Their first preference wins.';
  } else if (!oppPref) {
    motionNumber = govPref;
    reason = 'Only Government submitted. Their first preference wins.';
  } else if (govPref === oppPref) {
    motionNumber = govPref;
    reason = 'Both teams preferred the same motion.';
  } else if (govVeto && oppVeto && govVeto !== oppVeto) {
    motionNumber = all.find(m => m !== govVeto && m !== oppVeto);
    reason = 'Different vetoes. The remaining motion is debated.';
  } else if (govVeto && oppVeto && govVeto === oppVeto) {
    const remaining = all.filter(m => m !== govVeto);
    motionNumber = remaining[Math.floor(Math.random() * remaining.length)];
    reason = 'Same veto, different preferences. Coin toss between remaining motions.';
  } else {
    motionNumber = Math.floor(Math.random() * 3) + 1;
    reason = 'Could not determine result clearly. Coin toss decided.';
  }

  result = motions[motionNumber - 1];
  const infoSlide = infoslides[motionNumber - 1];

  const guild = await interaction.client.guilds.fetch(round.guild_id);
  const channels = await guild.channels.fetch();
  const channel = channels.find(c => 
    c.name.toLowerCase() === round.room_name.toLowerCase() && 
    c.isTextBased()
  ) || await interaction.client.channels.fetch(round.channel_id);

  console.log('Looking for channel:', round.room_name);
  console.log('Found channel:', channel?.name);

  let announcement = `**Room: ${round.room_name} | Round ${round.round_number}**\n`;
  announcement += `Debate on Motion ${motionNumber}\n`;
  if (infoSlide) announcement += `**Info Slide:** ${infoSlide}\n`;
  announcement += `**${result}**\n`;
  announcement += `*${reason}*`;

  await channel.send(announcement);
}
module.exports = { handleButton, resolveMotion };