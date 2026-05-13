const axios = require('axios');

async function handleJoinModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const privateUrl = interaction.fields.getTextInputValue('private_url');
  const userId = interaction.user.id;

  const urlKeyMatch = privateUrl.match(/privateurls\/([a-zA-Z0-9]+)/);
  if (!urlKeyMatch) {
    return interaction.editReply('Invalid private URL. Please paste the full URL from your Tabbycat email.');
  }

  const urlKey = urlKeyMatch[1];

  let settings;
  try {
    const res = await axios.get(`${process.env.APPS_SCRIPT_URL}?page=bot`, {
      maxRedirects: 5,
      headers: { Accept: 'application/json' }
    });
    settings = res.data;
  } catch (err) {
    return interaction.editReply('Could not fetch settings. Please try again.');
  }

  const { tabbycat_url, tabbycat_token, tournament_slug } = settings;

  let speakers;
  try {
    const res = await axios.get(
      `${tabbycat_url.replace(/\/$/, '')}/api/v1/tournaments/${tournament_slug}/speakers`,
      { headers: { Authorization: `Token ${tabbycat_token}`, Accept: 'application/json' } }
    );
    speakers = res.data;
  } catch (err) {
    return interaction.editReply('Could not fetch speakers from Tabbycat. Please try again.');
  }

  const speaker = speakers.find(s => s.url_key === urlKey);
  if (!speaker) {
    return interaction.editReply('Could not find your private URL in Tabbycat. Make sure you are using the correct URL.');
  }

  const teamUrl = speaker.team;
  let team;
  try {
    const res = await axios.get(teamUrl, {
      headers: { Authorization: `Token ${tabbycat_token}`, Accept: 'application/json' }
    });
    team = res.data;
  } catch (err) {
    return interaction.editReply('Could not fetch your team details. Please try again.');
  }

  try {
    await axios.get(
      `${process.env.APPS_SCRIPT_URL}?page=add_member&teamName=${encodeURIComponent(team.long_name)}&discordId=${userId}`,
      { maxRedirects: 5 }
    );
    await interaction.editReply(`You have been registered as **${speaker.name}** from **${team.long_name}**.`);
  } catch (err) {
    return interaction.editReply('Could not register you. Please try again.');
  }
}

module.exports = { handleJoinModal };