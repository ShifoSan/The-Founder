// 1. Load environment variables
require('dotenv').config();

// 2. Import required modules
const fs = require('fs');
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Environment Variable Validation ---
const requiredEnv = ['DISCORD_TOKEN', 'GEMINI_API_KEY', 'AI_CHANNEL_ID', 'STAFF_ROLE_ID', 'STAFF_LOG_CHANNEL'];
for (const env of requiredEnv) {
    if (!process.env[env]) {
        console.error(`[FATAL ERROR] Missing required environment variable: ${env}`);
        process.exit(1);
    }
}

// 3. Read System Instructions
let systemInstructions;
try {
    systemInstructions = fs.readFileSync('./System Instructions.txt', 'utf-8');
    console.log("✅ System Instructions loaded successfully.");
} catch (error) {
    console.error("[FATAL ERROR] Could not read 'System Instructions.txt'. Please ensure the file exists.");
    console.error(error);
    process.exit(1);
}

// 4. Initialize Express App
const app = express();
const PORT = process.env.PORT || 10000;

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Bot is running');
});

// Keep-alive endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`✅ HTTP server running on port ${PORT}`);
});

// The rest of the bot logic will go here

// 5. Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
console.log("✅ Discord Client initialized.");

// 6. Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  systemInstruction: systemInstructions,
});
console.log("✅ Gemini AI Model initialized successfully.");

// Cooldown management
const cooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 seconds

// Message Create Event
client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot || !message.guild) return;

        const isStaff = message.member.roles.cache.has(process.env.STAFF_ROLE_ID);
        const botMentioned = message.mentions.has(client.user);

        // --- Command Handling (Server-wide for mentions) ---
        if (botMentioned) {
            const commandContent = message.content.replace(/<@!?\d+>/g, '').trim();
            const args = commandContent.split(/\s+/);
            const command = args.shift().toLowerCase();

            // A) PURGE COMMAND
            if (command === 'purge') {
                if (!isStaff) return message.reply('❌ You do not have permission to use this command. Staff role required.');

                const numberMatch = commandContent.match(/\d+/);
                if (!numberMatch) return message.reply('❌ Please specify how many messages to delete (e.g., "purge 10 messages")');

                const deleteCount = parseInt(numberMatch[0], 10);
                if (deleteCount < 1 || deleteCount > 100) return message.reply('❌ Please specify a number between 1 and 100.');

                const messagesToDelete = await message.channel.messages.fetch({ limit: deleteCount + 1 });
                const deletedMessages = await message.channel.bulkDelete(messagesToDelete, true);

                const confirmMsg = await message.channel.send(`✅ Successfully deleted ${deletedMessages.size - 1} messages.`);
                setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
                return;
            }

            // B) WARN COMMAND
            if (command === 'warn') {
                if (!isStaff) return message.reply('❌ You do not have permission to use this command. Staff role required.');

                const targetUser = message.mentions.users.filter(u => u.id !== client.user.id).first();
                if (!targetUser) return message.reply('❌ Please mention a user to warn.');

                const targetMember = message.guild.members.cache.get(targetUser.id);
                if (targetMember && targetMember.roles.cache.has(process.env.STAFF_ROLE_ID)) {
                    return message.reply('❌ Cannot warn staff members.');
                }
                if (targetUser.id === message.author.id) {
                    return message.reply('❌ You cannot warn yourself.');
                }

                const reason = message.content.replace(/<@!?\d+>/g, '').replace(/warn/i, '').trim() || 'No reason provided';

                await message.channel.send(`⚠️ ${targetUser}, you have been warned by ${message.author}.\n**Reason:** ${reason}`);

                const staffLogChannel = client.channels.cache.get(process.env.STAFF_LOG_CHANNEL);
                if (staffLogChannel) {
                     const logMessage = `⚠️ **USER WARNING ISSUED**\n\n**Warned User:** ${targetUser.tag} (${targetUser.id})\n**Issued By:** ${message.author.tag} (${message.author.id})\n**Reason:** ${reason}\n**Channel:** <#${message.channel.id}>\n**Time:** ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
                     await staffLogChannel.send(logMessage);
                }

                await message.reply(`✅ Warning issued to ${targetUser.tag}`);
                return;
            }

            // C) SAY COMMAND
            if (command === 'say') {
                const textToEcho = commandContent.substring(command.length).trim();
                if (!textToEcho) return message.reply('❌ Please provide text to echo (e.g., "@The Founder say Hello everyone")');

                try {
                    await message.delete();
                } catch (error) {}
                await message.channel.send(textToEcho);
                return;
            }
        }

        // --- Staff are exempt from AI replies and cooldowns ---
        if (isStaff) return;

        // --- Cooldown for non-staff ---
        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + COOLDOWN_TIME;
            if (Date.now() < expirationTime) return; // Silently ignore
        }
        cooldowns.set(message.author.id, Date.now());

        // --- AI Auto-Reply (only in the designated channel) ---
        if (message.channel.id === process.env.AI_CHANNEL_ID) {
            await message.channel.sendTyping();

            const messages = await message.channel.messages.fetch({ limit: 15 });
            const context = messages
                .filter(m => !m.author.bot && m.content.length > 0)
                .reverse()
                .map(m => {
                    const timestamp = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
                    const content = m.content.length > 500 ? m.content.slice(0, 500) + '...' : m.content;
                    return `[${timestamp}] ${m.author.username}: ${content}`;
                })
                .join('\n');

            const prompt = `You are "The Founder", an AI assistant in a Discord server.

IMPORTANT RULES:
- You are NOT a moderator. Do NOT warn users about their behavior.
- You are NOT responsible for enforcing rules automatically.
- You CANNOT issue warnings on your own. Only staff can issue warnings via the warn command.
- Do NOT mention spam, flooding, or rule violations in your responses.
- Simply have friendly, helpful conversations.
- Staff members (with role <@&${process.env.STAFF_ROLE_ID}>) can chat freely without any restrictions.

Conversation History:
${context}

Current User (${message.author.username}): ${message.content}

Respond naturally and helpfully.`;

            const generationConfig = {
                temperature: 0.9,
                maxOutputTokens: 1024,
            };

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig,
            });

            const response = result.response;
            const text = response.text();

            if (text) {
                await message.reply(text);
            }
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in messageCreate handler:`, error);
        message.reply('❌ An error occurred while processing your request. Please try again.').catch(console.error);
    }
});


// 7. Bot Ready Event
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('Listening to messages', { type: 'LISTENING' });
});

// 8. Bot Login
client.login(process.env.DISCORD_TOKEN);
