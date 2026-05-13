require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands = new Collection();

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}
console.log('Loaded commands:', [...client.commands.keys()]);

client.once('ready', () => {
  console.log(`JanusBot is online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
      } else {
        await interaction.editReply({ content: 'Something went wrong.' });
      }
    }
  }

  if (interaction.isButton()) {
    const { handleButton } = require('./handlers/motionResolver');
    await handleButton(interaction);
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'join_team') {
      await interaction.reply({ content: 'Please use /join command instead.', ephemeral: true });
    }
  }
   if (interaction.isModalSubmit()) {
    if (interaction.customId === 'join_modal') {
      const { handleJoinModal } = require('./handlers/joinHandler');
      await handleJoinModal(interaction);
    }
  }
});

client.login(process.env.BOT_TOKEN);