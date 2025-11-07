// 1. Load environment variables
require('dotenv').config();

// 2. Import required modules
const fs = require('fs');
const path = require('path');
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
    const systemInstructionsPath = path.join(__dirname, 'System Instructions.txt');
    systemInstructions = fs.readFileSync(systemInstructionsPath, 'utf-8');
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
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
console.log("✅ Gemini AI Model initialized successfully.");

// --- Personality Management ---
const personalities = new Map();
const currentPersonalities = new Map(); // channelId -> personalityName

function loadPersonalities() {
    try {
        // Load default personality
        const defaultPersonalityPath = path.join(__dirname, 'System Instructions.txt');
        const defaultPersonality = fs.readFileSync(defaultPersonalityPath, 'utf-8');
        personalities.set('default', defaultPersonality);
        console.log('✅ Loaded default personality.');

        // Load character personalities
        const personalitiesDir = path.join(__dirname, 'personalities');
        const personalityFiles = fs.readdirSync(personalitiesDir).filter(file => file.endsWith('.txt'));
        for (const file of personalityFiles) {
            const personalityName = file.replace('.txt', '').toLowerCase();
            const filePath = path.join(personalitiesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            personalities.set(personalityName, content);
            console.log(`✅ Loaded personality: ${personalityName}`);
        }
    } catch (error) {
        console.error('⚠️ Could not load personalities. Falling back to default only.', error);
        if (!personalities.has('default')) {
            // A failsafe if even the default is missing
             personalities.set('default', 'You are a helpful AI assistant.');
        }
    }
}

loadPersonalities();

// Cooldown management
const cooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 seconds

// Chat session storage with metadata
const chatSessions = new Map(); // channelId -> { session, lastActivity }

// Configuration
const AI_CHANNEL_ID = process.env.AI_CHANNEL_ID || '1434115853422432379';
const SESSION_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Get or create a chat session for a channel
 * @param {string} channelId - Discord channel ID
 * @returns {ChatSession} Gemini chat session
 */
function getChatSession(channelId) {
  const now = Date.now();

  if (chatSessions.has(channelId)) {
    const sessionData = chatSessions.get(channelId);
    sessionData.lastActivity = now;
    return sessionData.session;
  }

  const personalityName = currentPersonalities.get(channelId) || 'default';
  let systemInstruction = personalities.get(personalityName);

  if (!systemInstruction) {
      console.error(`[CRITICAL] No system instruction found for personality '${personalityName}'. Falling back to a generic instruction.`);
      systemInstruction = 'You are a helpful assistant.';
  }

  console.log(`[SESSION_CREATE] Creating new session for channel ${channelId} with personality: ${personalityName}`);
  console.log(`[SESSION_CREATE] System Instruction content (first 80 chars): "${systemInstruction.substring(0, 80)}..."`);


  const newSession = model.startChat({
    history: [],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.9
    },
    // FIX: Wrap the string in the required 'Content' object structure
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
  });

  chatSessions.set(channelId, {
    session: newSession,
    lastActivity: now,
    createdAt: now
  });

  console.log(`[${new Date().toISOString()}] Successfully created new chat session for channel ${channelId}`);

  return newSession;
}


/**
 * Clean up old/expired chat sessions
 */
function cleanupOldSessions() {
  const now = Date.now();
  let removedCount = 0;

  for (const [channelId, sessionData] of chatSessions.entries()) {
    const sessionAge = now - sessionData.lastActivity;

    if (sessionAge > SESSION_TIMEOUT) {
      chatSessions.delete(channelId);
      removedCount++;
      console.log(`[${new Date().toISOString()}] Removed expired session for channel ${channelId} (age: ${Math.round(sessionAge / 1000 / 60 / 60)} hours)`);
    }
  }

  if (removedCount > 0) {
    console.log(`[${new Date().toISOString()}] Cleanup complete: Removed ${removedCount} expired session(s). Active sessions: ${chatSessions.size}`);
  }
}

/**
 * Clear a specific channel's session (useful for reset command)
 * @param {string} channelId - Discord channel ID
 */
function clearChatSession(channelId) {
  if (chatSessions.has(channelId)) {
    chatSessions.delete(channelId);
    console.log(`[${new Date().toISOString()}] Cleared chat session for channel ${channelId}`);
    return true;
  }
  return false;
}

// --- Reusable AI Response Function ---
async function handleAIResponse(message) {
  try {
    const channelId = message.channel.id;

    await message.channel.sendTyping();

    const chat = getChatSession(channelId);

    const result = await chat.sendMessage(message.content);
    const response = result.response.text();

    await message.reply(response);

    console.log(`[${new Date().toISOString()}] AI Response sent in channel ${channelId} (${message.author.username})`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in AI response:`, error);

    if (error.message?.includes('SAFETY')) {
      await message.reply('⚠️ I cannot respond to that due to safety filters.').catch(() => {});
    } else if (error.message?.includes('RATE_LIMIT')) {
      await message.reply('⚠️ I\'m receiving too many requests. Please wait a moment.').catch(() => {});
    } else {
      await message.reply('❌ An error occurred while processing your message. Please try again.').catch(() => {});
    }
  }
}

// --- New Summon Command Function ---
async function handleSummonCommand(message) {
  try {
    const targetUser = message.mentions.users.filter(u => u.id !== client.user.id).first();

    if (!targetUser) {
      return message.reply('❌ Please mention a user to summon! Example: `@The Founder summon @User`');
    }

    await message.channel.sendTyping();

    const summonPrompt = `You are a medieval herald making a grand proclamation to summon someone.

Generate a dramatic, theatrical, medieval-style proclamation to summon "${targetUser.username}".

Requirements:
- Write in old English/medieval style language (thee, thou, hath, etc.)
- Mention "${targetUser.username}" at least 3-4 times throughout the text
- Make it dramatic and over-the-top
- Keep it between 80-120 words
- Include dramatic phrases like "Hear ye, hear ye!", "By royal decree", "Let it be known"
- Make it entertaining and fun
- Do NOT use any markdown formatting

Example tone: "Hear ye, hear ye! By the ancient laws of this realm, we do hereby summon ${targetUser.username}! Let ${targetUser.username} make haste to this channel, for their presence is required most urgently! The court awaits ${targetUser.username} with great anticipation!"

Generate the proclamation now:`;

    const result = await model.generateContent(summonPrompt);
    const summonText = result.response.text();

    const finalText = summonText.replace(new RegExp(targetUser.username, 'gi'), `<@${targetUser.id}>`);

    await message.channel.send(finalText);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in summon command:`, error);
    await message.reply('❌ An error occurred while summoning. Please try again.').catch(() => {});
  }
}

// --- New Persona Command Function ---
async function handlePersonaCommand(message, args) {
    const personalityEmojis = {
        'default': '🤖',
        'eren': '⚔️',
        'mikasa': '🧣',
        'levi': '☕',
        'ymir': '👑'
    };
    const descriptions = {
        'default': 'The Founder (standard moderation bot)',
        'eren': 'Eren Yeager (determined, cold, freedom-obsessed)',
        'mikasa': 'Mikasa Ackerman (stoic, protective, loyal)',
        'levi': 'Levi Ackerman (blunt, clean freak, skilled)',
        'ymir': 'Ymir Fritz (tragic, gentle, seeking freedom)'
    };

    const subcommand = args[0] ? args[0].toLowerCase() : '';

    if (subcommand === 'list') {
        let list = '📋 **Available Personalities:**\n\n';
        for (const [name, desc] of Object.entries(descriptions)) {
            list += `${personalityEmojis[name]} **${name}** - ${desc}\n`;
        }
        list += `\nUsage: \`@The Founder persona <name>\`\nExample: \`@The Founder persona eren\``;
        return message.reply(list);
    }

    if (!subcommand) {
        const currentPersona = currentPersonalities.get(message.channel.id) || 'default';
        return message.reply(`Current personality: **${descriptions[currentPersona].split('(')[0].trim()}** (${personalityEmojis[currentPersona]})`);
    }

    if (personalities.has(subcommand)) {
        currentPersonalities.set(message.channel.id, subcommand);
        clearChatSession(message.channel.id);
        const personaName = descriptions[subcommand].split('(')[0].trim();
        return message.reply(`${personalityEmojis[subcommand]} Personality switched to **${personaName}**!\nConversation history reset.`);
    } else {
        return message.reply(`❌ Personality '${subcommand}' not found. Use \`@The Founder persona list\` to see available options.`);
    }
}

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

                const numDeleted = deletedMessages.size > 0 ? deletedMessages.size - 1 : 0;
                const confirmMsg = await message.channel.send(`✅ Successfully deleted ${numDeleted} message(s).`);
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

            // D) SUMMON COMMAND
            if (command === 'summon') {
                await handleSummonCommand(message);
                return;
            }

            // E) RESET COMMAND
            if (command === 'reset' || command === 'restart') {
              if (!isStaff) {
                return message.reply('❌ Only staff members can reset conversations.');
              }

              const channelId = message.channel.id;
              if (clearChatSession(channelId)) {
                return message.reply('✅ Conversation history reset! Starting fresh.');
              } else {
                return message.reply('ℹ️ No active conversation to reset.');
              }
            }

            // F) PERSONA COMMAND
            if (command === 'persona') {
                await handlePersonaCommand(message, args);
                return;
            }
        }

        // --- AI Auto-Reply ---
        if (message.channel.id === process.env.AI_CHANNEL_ID) {
            if (!isStaff) { // Apply cooldown only to non-staff
                if (cooldowns.has(message.author.id)) {
                    const expirationTime = cooldowns.get(message.author.id) + COOLDOWN_TIME;
                    if (Date.now() < expirationTime) return; // Silently ignore
                }
                cooldowns.set(message.author.id, Date.now());
                setTimeout(() => cooldowns.delete(message.author.id), COOLDOWN_TIME);
            }
            await handleAIResponse(message);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in messageCreate handler:`, error);
        message.reply('❌ An error occurred while processing your request. Please try again.').catch(console.error);
    }
});


// 7. Bot Ready Event
client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`✅ Using gemini-2.5-flash-lite model`);

  client.user.setPresence({
    activities: [{ name: 'messages in AI channel', type: 4 }],
    status: 'online'
  });

  setInterval(() => {
    cleanupOldSessions();
  }, CLEANUP_INTERVAL);

  console.log(`✅ Session cleanup scheduled (runs every ${CLEANUP_INTERVAL / 1000 / 60} minutes)`);
  console.log(`✅ Bot is ready! Monitoring channel: ${AI_CHANNEL_ID}`);
});

// 8. Bot Login
client.login(process.env.DISCORD_TOKEN);
