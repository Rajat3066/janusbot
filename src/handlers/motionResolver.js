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
      db.prepare('UPDATE rounds SET gov_veto = ? WHERE id = ?').run(motionIndex, roundId);
      await interaction.reply({ content: `Veto recorded. Your submission is complete.`, ephemeral: true });
    }

    if (side === 'opp') {
      if (round.opp_veto) {
        return interaction.reply({ content: 'Opposition has already submitted their veto.', ephemeral: true });
      }
      db.prepare('UPDATE rounds SET opp_veto = ? WHERE id = ?').run(motionIndex, roundId);
      await interaction.reply({ content: `Veto recorded. Your submission is complete.`, ephemeral: true });
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
  let result;
  let reason;

  const govPref = round.gov_ranking ? parseInt(round.gov_ranking) : null;
  const oppPref = round.opp_ranking ? parseInt(round.opp_ranking) : null;
  const govVeto = round.gov_veto ? parseInt(round.gov_veto) : null;
  const oppVeto = round.opp_veto ? parseInt(round.opp_veto) : null;

  if (!govPref && !oppPref) {
    const coin = Math.floor(Math.random() * 3);
    result = motions[coin];
    reason = 'Neither team submitted. Coin toss decided the motion.';
  } else if (!govPref) {
    result = motions[oppPref - 1];
    reason = 'Only Opposition submitted. Their first preference wins.';
  } else if (!oppPref) {
    result = motions[govPref - 1];
    reason = 'Only Government submitted. Their first preference wins.';
  } else {
    if (govPref === oppPref) {
      result = motions[govPref - 1];
      reason = 'Both teams preferred the same motion.';
    } else {
      const all = [1, 2, 3];

      const effectiveGovVeto = govVeto || all.find(m => m !== govPref && m !== oppPref);
      const effectiveOppVeto = oppVeto || all.find(m => m !== govPref && m !== oppPref);

      if (effectiveGovVeto !== effectiveOppVeto) {
        const debated = all.find(m => m !== effectiveGovVeto && m !== effectiveOppVeto);
        result = motions[debated - 1];
        reason = 'Different vetoes. The remaining motion is debated.';
      } else {
        const remaining = all.filter(m => m !== effectiveGovVeto);
        if (govPref === oppPref) {
          result = motions[govPref - 1];
          reason = 'Same veto, same preference. That motion is debated.';
        } else {
          const coin = remaining[Math.floor(Math.random() * remaining.length)];
          result = motions[coin - 1];
          reason = 'Same veto, different preferences. Coin toss between remaining motions.';
        }
      }
    }
  }

  const channel = await interaction.client.channels.fetch(round.channel_id);
  await channel.send(`**Motion selected:** ${result}\n*${reason}*`);
}
module.exports = { handleButton, resolveMotion };