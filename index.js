// 1. Load environment variables
require('dotenv').config();

// 2. Import required modules
const express = require('express');
const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const aotrHandler = require('./aotr-handler.js');

let currentStatusIndex = 0;

// --- New Global State Variables for Fun Commands ---
let roastDisabled = false;
let roastBlacklist = [];
let gaslightingActive = false;
// --- End Global State Variables ---

// --- Config Management ---
function loadConfig() {
  try {
    const data = fs.readFileSync('./config.json', 'utf8');
    const config = JSON.parse(data);

    // Ensure all required fields exist with defaults
    return {
      botEnabled: config.botEnabled ?? true,
      aiChannelId: config.aiChannelId || process.env.AI_CHANNEL_ID,
      statusMessages: config.statusMessages || [],
      cooldownTime: config.cooldownTime ?? 3,
      cooldownUnit: config.cooldownUnit || 'seconds',
      sessionTimeout: config.sessionTimeout ?? 48,
      sessionTimeoutUnit: config.sessionTimeoutUnit || 'hours',
      personalityDefaults: config.personalityDefaults || {},
      disabledCommands: config.disabledCommands || [],
      rateLimitSettings: config.rateLimitSettings || {
        enabled: true,
        maxRequests: 10,
        timeWindow: 60
      },
      autoModeration: config.autoModeration || {
        enabled: false,
        deleteSpam: false,
        warnOnCaps: false
      }
    };
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

let botConfig = loadConfig();

fs.watch('./config.json', (eventType) => {
  if (eventType === 'change') {
    console.log('Config file changed, reloading...');
    botConfig = loadConfig();
  }
});
// --- End Config Management ---

const GUILD_ID = '1316791123422740572'; // The Paradis Legion server ID

const slashCommands = [
  {
    name: 'purge',
    description: 'Delete multiple messages from channel (Staff only)',
    options: [
      {
        name: 'amount',
        description: 'Number of messages to delete (1-100)',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 100
      }
    ]
  },
  {
    name: 'warn',
    description: 'Issue warning to a user (Staff only)',
    options: [
      {
        name: 'user',
        description: 'User to warn',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for warning',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  },
  {
    name: 'announce',
    description: 'Send a beautiful announcement embed (Staff only)',
    options: [
      {
        name: 'title',
        description: 'Announcement title',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'description',
        description: 'Announcement body/message',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'footer',
        description: 'Footer text (optional)',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'show_avatar',
        description: 'Show your avatar in announcement? (optional)',
        type: ApplicationCommandOptionType.Boolean,
        required: false
      }
    ]
  },
  {
    name: 'say',
    description: 'Make the bot say something',
    options: [
      {
        name: 'message',
        description: 'Message to echo',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  },
  {
    name: 'summon',
    description: 'Dramatically summon a user',
    options: [
      {
        name: 'user',
        description: 'User to summon',
        type: ApplicationCommandOptionType.User,
        required: true
      }
    ]
  },
  {
    name: 'persona',
    description: 'Switch bot personality or view current',
    options: [
      {
        name: 'name',
        description: 'Personality name (eren, mikasa, levi, ymir, default) or leave empty to view',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'Default (The Founder)', value: 'default' },
          { name: 'Eren Yeager', value: 'eren' },
          { name: 'Mikasa Ackerman', value: 'mikasa' },
          { name: 'Levi Ackerman', value: 'levi' },
          { name: 'Ymir Fritz', value: 'ymir' },
          { name: 'Unhinged', value: 'unhinged' }
        ]
      },
      {
        name: 'action',
        description: 'Special actions',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'List all personalities', value: 'list' },
          { name: 'Reset to default', value: 'reset' }
        ]
      }
    ]
  },
  {
    name: 'help',
    description: 'Show bot help menu',
    options: [
      {
        name: 'category',
        description: 'Help category to view',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'Overview', value: 'overview' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Personality System', value: 'persona' },
          { name: 'AI Features', value: 'ai' },
          { name: 'Game Commands', value: 'game' },
          { name: 'Fun Commands', value: 'fun' },
          { name: 'Bot Management', value: 'management' },
          { name: 'All Categories', value: 'all' }
        ]
      }
    ]
  },
  {
    name: 'survival',
    description: 'Check survival odds in Attack on Titan world',
    options: [
      {
        name: 'user',
        description: 'Target user (leave empty for yourself)',
        type: ApplicationCommandOptionType.User,
        required: false
      }
    ]
  },
  {
    name: 'titan',
    description: 'Get assigned a random Titan Shifter type',
    options: [
      {
        name: 'user',
        description: 'Target user (leave empty for yourself)',
        type: ApplicationCommandOptionType.User,
        required: false
      }
    ]
  },
  {
    name: 'stats',
    description: 'View Attack on Titan RPG stats',
    options: [
      {
        name: 'user',
        description: 'Target user (leave empty for yourself)',
        type: ApplicationCommandOptionType.User,
        required: false
      }
    ]
  },
  {
    name: 'roast',
    description: 'Generate an AI-powered roast for a user.',
    options: [
        {
            name: 'user',
            description: 'The user to roast.',
            type: ApplicationCommandOptionType.User,
            required: true
        },
        {
            name: 'intensity',
            description: 'The intensity of the roast.',
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                { name: 'Mild', value: 'mild' },
                { name: 'Medium', value: 'medium' },
                { name: 'Spicy', value: 'spicy' },
                { name: 'Hardcore', value: 'hardcore' }
            ]
        }
    ]
  },
  {
    name: 'roast-disable',
    description: 'Disable or enable the roast command for the server.'
  },
  {
    name: 'roast-blacklist',
    description: 'Toggle roast protection for yourself.'
  },
  {
    name: 'mandela',
    description: 'Create a fictional, absurd server event.',
    options: [
        {
            name: 'fake_event',
            description: 'A short description of the fake event.',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
  },
  {
    name: 'fake-history',
    description: 'Fabricate a fake history for a user.',
    options: [
        {
            name: 'user',
            description: 'The user to create a fake history for.',
            type: ApplicationCommandOptionType.User,
            required: true
        }
    ]
  },
  {
    name: 'gaslight-reset',
    description: 'Resets all gaslighting and fictional states.'
  },
  {
    name: 'control',
    description: 'Bot management & configuration (Staff only)',
    options: [
      {
        name: 'toggle-bot',
        description: 'Enable or disable the bot',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{
          name: 'state',
          description: 'Bot state (true = enabled, false = disabled)',
          type: ApplicationCommandOptionType.Boolean,
          required: true
        }]
      },
      {
        name: 'set-ai-channel',
        description: 'Change AI auto-reply channel',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{
          name: 'channel',
          description: 'New AI channel',
          type: ApplicationCommandOptionType.Channel,
          required: true
        }]
      },
      {
        name: 'set-cooldown',
        description: 'Set cooldown time for non-staff users',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'value',
            description: 'Cooldown value',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 60
          },
          {
            name: 'unit',
            description: 'Time unit',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Seconds', value: 'seconds' },
              { name: 'Minutes', value: 'minutes' }
            ]
          }
        ]
      },
      {
        name: 'set-session-timeout',
        description: 'Set AI session timeout duration',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'value',
            description: 'Timeout value',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 168
          },
          {
            name: 'unit',
            description: 'Time unit',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Hours', value: 'hours' },
              { name: 'Days', value: 'days' }
            ]
          }
        ]
      },
      {
        name: 'set-personality-default',
        description: 'Set default personality for a channel',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'channel',
            description: 'Target channel',
            type: ApplicationCommandOptionType.Channel,
            required: true
          },
          {
            name: 'personality',
            description: 'Personality name',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Default (The Founder)', value: 'default' },
              { name: 'Eren Yeager', value: 'eren' },
              { name: 'Mikasa Ackerman', value: 'mikasa' },
              { name: 'Levi Ackerman', value: 'levi' },
              { name: 'Ymir Fritz', value: 'ymir' },
              { name: 'Unhinged', value: 'unhinged' }
            ]
          }
        ]
      },
      {
        name: 'disable-commands',
        description: 'Hide command categories from Discord',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'category',
            description: 'Command category',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Game Commands', value: 'game' },
              { name: 'Fun Commands', value: 'fun' },
              { name: 'Persona System', value: 'persona' },
              { name: 'All Categories', value: 'all' }
            ]
          },
          {
            name: 'enable',
            description: 'True = enable category, False = disable category',
            type: ApplicationCommandOptionType.Boolean,
            required: true
          }
        ]
      },
      {
        name: 'rate-limit',
        description: 'Configure rate limiting',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'enabled',
            description: 'Enable/disable rate limiting',
            type: ApplicationCommandOptionType.Boolean,
            required: true
          },
          {
            name: 'max_requests',
            description: 'Maximum requests allowed',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 100
          },
          {
            name: 'time_window',
            description: 'Time window in seconds',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 10,
            max_value: 300
          }
        ]
      },
      {
        name: 'auto-mod',
        description: 'Toggle auto-moderation features',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'feature',
            description: 'Feature to toggle',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Auto-Moderation System', value: 'enabled' },
              { name: 'Delete Spam', value: 'deleteSpam' },
              { name: 'Warn on Caps', value: 'warnOnCaps' }
            ]
          },
          {
            name: 'state',
            description: 'Enable/disable feature',
            type: ApplicationCommandOptionType.Boolean,
            required: true
          }
        ]
      },
      {
        name: 'view-config',
        description: 'View current bot configuration',
        type: ApplicationCommandOptionType.Subcommand
      },
      {
        name: 'clear-sessions',
        description: 'Clear all AI chat sessions',
        type: ApplicationCommandOptionType.Subcommand
      },
      {
        name: 'add-status',
        description: 'Add new rotating status message',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{
          name: 'message',
          description: 'Status message text',
          type: ApplicationCommandOptionType.String,
          required: true,
          max_length: 128
        }]
      },
      {
        name: 'remove-status',
        description: 'Remove status message by index',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{
          name: 'index',
          description: 'Index to remove (see view-config)',
          type: ApplicationCommandOptionType.Integer,
          required: true,
          min_value: 0
        }]
      }
    ]
  }
];

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

// Dashboard API endpoints
app.use(express.json()); // Parse JSON bodies

// Get bot status
app.get('/api/status', (req, res) => {
  res.json({
    online: client.isReady(),
    enabled: botConfig?.botEnabled || true,
    uptime: process.uptime()
  });
});

// Toggle bot on/off
app.post('/api/toggle', (req, res) => {
  const { enabled } = req.body;

  if (!botConfig) {
    return res.status(500).json({ error: 'Config not loaded' });
  }

  botConfig.botEnabled = enabled;

  if (saveConfig(botConfig)) {
    res.json({ success: true, enabled: botConfig.botEnabled });
  } else {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Get current config
app.get('/api/config', (req, res) => {
  if (!botConfig) {
    return res.status(500).json({ error: 'Config not loaded' });
  }
  res.json(botConfig);
});

// Update config
app.post('/api/update-config', (req, res) => {
  const { aiChannelId, statusMessages } = req.body;

  if (!botConfig) {
    return res.status(500).json({ error: 'Config not loaded' });
  }

  if (aiChannelId) botConfig.aiChannelId = aiChannelId;
  if (statusMessages) botConfig.statusMessages = statusMessages;

  if (saveConfig(botConfig)) {
    res.json({ success: true, config: botConfig });
  } else {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Restart bot
app.post('/api/restart', (req, res) => {
  res.json({ success: true, message: 'Bot restarting...' });

  setTimeout(() => {
    process.exit(0); // Render will auto-restart
  }, 1000);
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
global.COOLDOWN_TIME = 3000; // 3 seconds

// Chat session storage with metadata
const chatSessions = new Map(); // channelId -> { session, lastActivity }

// Configuration
global.SESSION_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours
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

  if (gaslightingActive) {
    systemInstruction += `\n\n[GASLIGHTING MODE ACTIVE] Occasionally (about 10% of the time), add subtle gaslighting elements to your responses. This can include referencing fake past conversations, insisting things happened that didn't, or creating false memories. Always keep it obviously fictional, playful, and never harmful.`;
  }

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

    if (sessionAge > global.SESSION_TIMEOUT) {
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
const personalityEmojis = {
    'default': '🤖',
    'eren': '⚔️',
    'mikasa': '🧣',
    'levi': '☕',
    'ymir': '👑',
    'unhinged': '🤪'
};
const descriptions = {
    'default': 'The Founder (standard moderation bot)',
    'eren': 'Eren Yeager (determined, cold, freedom-obsessed)',
    'mikasa': 'Mikasa Ackerman (stoic, protective, loyal)',
    'levi': 'Levi Ackerman (blunt, clean freak, skilled)',
    'ymir': 'Ymir Fritz (tragic, gentle, seeking freedom)',
    'unhinged': 'Chaotic, random, existential bot humor (PG-rated chaos)'
};
const availablePersonalities = Object.keys(descriptions);

function createPersonaListEmbed() {
    let list = '📋 **Available Personalities:**\n\n';
    for (const [name, desc] of Object.entries(descriptions)) {
        list += `${personalityEmojis[name]} **${name}** - ${desc}\n`;
    }
    list += `\nUsage: \`/persona name: <name>\`\nExample: \`/persona name: eren\``;
    return {
        title: '🎭 Available Personalities',
        description: list,
        color: 0xFF0000,
        footer: { text: 'Use the /persona command to switch!' }
    };
}

async function handlePersonaCommand(message, args) {

    const subcommand = args[0] ? args[0].toLowerCase() : '';

    if (subcommand === 'list') {
        const embed = createPersonaListEmbed();
        return message.reply({ embeds: [embed] });
    }

    if (!subcommand) {
        const currentPersona = currentPersonalities.get(message.channel.id) || 'default';
        return message.reply(`Current personality: **${descriptions[currentPersona].split('(')[0].trim()}** (${personalityEmojis[currentPersona]})`);
    }

    if (subcommand === 'reset' || subcommand === 'default') {
        currentPersonalities.set(message.channel.id, 'default');
        clearChatSession(message.channel.id);
        return message.reply(`🤖 Personality reset to **The Founder** (default).\nConversation history cleared.`);
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

// --- Help Command Functions ---

/**
 * Handle help command with clean embeds
 */
async function handleHelpCommand(message, content) {
  try {
    // Extract subcommand if provided
    const args = content.split(/\s+/).filter(arg => arg.length > 0);
    const subcommand = args[1]?.toLowerCase() || 'overview';

    let embeds = [];

    switch (subcommand) {
      case 'moderation':
        embeds = [createModerationEmbed()];
        break;
      case 'persona':
        embeds = [createPersonaEmbed()];
        break;
      case 'ai':
        embeds = [createAIEmbed()];
        break;
      case 'game':
        embeds = [createGameEmbed()];
        break;
      case 'fun':
        embeds = [createFunEmbed()];
        break;
      case 'all':
        embeds = [
          createOverviewEmbed(),
          createModerationEmbed(),
          createPersonaEmbed(),
          createAIEmbed(),
          createGameEmbed(),
          createFunEmbed(),
          createStatusEmbed()
        ];
        break;
      case 'overview':
      default:
        embeds = [createOverviewEmbed()];
        break;
    }

    // Send embeds
    await message.reply({ embeds: embeds });

    console.log(`[${new Date().toISOString()}] Help command used: ${subcommand}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in help command:`, error);
    await message.reply('❌ Error displaying help. Please try again.').catch(() => {});
  }
}

/**
 * Create Overview Embed
 */
function createFunEmbed() {
    return {
        title: '🎭 Fun Commands',
        description: 'Just for fun commands.',
        color: 0x7289DA,
        fields: [
            {
                name: '/roast @user [intensity]',
                value: 'Generate a roast for any user. Intensity can be `mild`, `medium`, `spicy`, or `hardcore`.',
                inline: false
            },
            {
                name: '/roast-disable',
                value: 'Disable all roast commands for the server.',
                inline: false
            },
            {
                name: '/roast-blacklist',
                value: 'Opt yourself out of being roasted by anyone.',
                inline: false
            },
            {
                name: '/mandela [fake-event]',
                value: 'Bot creates an obviously absurd fake server event.',
                inline: false
            },
            {
                name: '/fake-history @user',
                value: 'Fabricate an obviously fake, lighthearted user history.',
                inline: false
            },
            {
                name: '/gaslight-reset',
                value: 'Resets all gaslighting and fictional states.',
                inline: false
            }
        ],
        footer: { text: 'Enjoy responsibly!' },
        timestamp: new Date()
    };
}

function createBotManagementEmbed() {
  return {
    title: '⚙️ Bot Management Commands',
    description: 'Staff-only commands for bot configuration and control',
    color: 0xFF0000,
    fields: [
      {
        name: '/control toggle-bot',
        value: 'Enable or disable the entire bot\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control set-ai-channel',
        value: 'Change the AI auto-reply channel\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control set-cooldown',
        value: 'Set cooldown time for non-staff users\n**Permission:** Staff only\n**Options:** Value (1-60) & Unit (seconds/minutes)',
        inline: false
      },
      {
        name: '/control set-session-timeout',
        value: 'Set AI session timeout duration\n**Permission:** Staff only\n**Options:** Value (1-168) & Unit (hours/days)',
        inline: false
      },
      {
        name: '/control set-personality-default',
        value: 'Set default personality for a channel\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control disable-commands',
        value: 'Hide command categories from Discord\n**Permission:** Staff only\n**Categories:** game, fun, persona, all',
        inline: false
      },
      {
        name: '/control rate-limit',
        value: 'Configure rate limiting settings\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control auto-mod',
        value: 'Toggle auto-moderation features\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control view-config',
        value: 'View current bot configuration\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control clear-sessions',
        value: 'Clear all AI chat sessions\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control add-status',
        value: 'Add new rotating status message\n**Permission:** Staff only',
        inline: false
      },
      {
        name: '/control remove-status',
        value: 'Remove status message by index\n**Permission:** Staff only',
        inline: false
      }
    ],
    footer: { text: 'All settings saved to config.json and apply immediately' },
    timestamp: new Date()
  };
}

function createOverviewEmbed() {
  return {
    title: '🤖 The Founder Bot - Complete Guide',
    description: 'Your AI-powered moderation and personality-switching assistant!',
    color: 0xFF0000, // Red
    fields: [
      {
        name: '🛡️ Moderation Commands',
        value: '`purge` `warn` `say` `summon` `announce`\n\nType: `@The Founder help moderation`',
        inline: false
      },
      {
        name: '🎮 Game Commands',
        value: '`survival` `titan` `stats`\n\nType: `@The Founder help game`',
        inline: false
      },
      {
        name: '🎭 Fun Commands',
        value: '`roast` `mandela` `fake-history`\n\nType: `@The Founder help fun`',
        inline: false
      },
      {
        name: '⚙️ Bot Management',
        value: 'Staff-only configuration controls\n\nType: `@The Founder help management`',
        inline: false
      },
      {
        name: '🎭 Personality System',
        value: 'Switch between 4 Attack on Titan characters\n\nType: `@The Founder help persona`',
        inline: false
      },
      {
        name: '💬 AI Features',
        value: 'Smart conversation, advanced memory, auto-replies\n\nType: `@The Founder help ai`',
        inline: false
      },
      {
        name: '📊 Rotating Status',
        value: 'Bot status changes every 2 minutes with unhinged AoT facts!',
        inline: false
      },
      {
        name: '📖 View All',
        value: 'Type: `@The Founder help all`',
        inline: false
      }
    ],
    footer: {
      text: 'The Founder Bot v2.0 | Created by ShifoSan',
      icon_url: client.user.displayAvatarURL()
    },
    timestamp: new Date()
  };
}

/**
 * Create Moderation Embed
 */
function createModerationEmbed() {
  return {
    title: '🛡️ Moderation Commands',
    description: 'Staff and user moderation tools',
    color: 0xFF0000,
    fields: [
      {
        name: '⚔️ purge <number>',
        value: 'Remove up to 100 messages\n**Permission:** Staff only\n**Usage:** `@The Founder purge 50`',
        inline: false
      },
      {
        name: '⚠️ warn @user <reason>',
        value: 'Issue formal warning\n**Permission:** Staff only\n**Logged:** Staff channel\n**Usage:** `@The Founder warn @user spamming`',
        inline: false
      },
      {
        name: '💬 say <message>',
        value: 'Echo text as the bot\n**Permission:** Anyone\n**Usage:** `@The Founder say Hello!`',
        inline: false
      },
      {
        name: '📢 summon @user',
        value: 'Dramatically summon someone\n**Permission:** Anyone\n**Usage:** `@The Founder summon @user`\n**Bonus:** Generates theatrical medieval text!',
        inline: false
      },
      {
        name: '📣 announce <title> || <description> || [footer] || [show_avatar]',
        value: 'Send a professional announcement embed\n**Permission:** Staff only\n**Usage:** `@The Founder announce <title> || <desc>`',
        inline: false
      }
    ],
    footer: { text: 'Staff commands marked with Staff only' },
    timestamp: new Date()
  };
}

/**
 * Create Personality Embed
 */
function createPersonaEmbed() {
  return {
    title: '🎭 Personality System',
    description: 'Switch bot personalities per channel!',
    color: 0xFF0000,
    fields: [
      {
        name: 'Available Personalities',
        value: '⚔️ **Eren** - Determined, cold, freedom-obsessed\n🧣 **Mikasa** - Stoic, protective, loyal\n☕ **Levi** - Blunt, clean freak, skilled\n👑 **Ymir** - Tragic, gentle, seeking freedom\n🤖 **Default** - The Founder (standard)',
        inline: false
      },
      {
        name: 'How to Switch',
        value: '`@The Founder persona eren`\n`@The Founder persona mikasa`\n`@The Founder persona levi`\n`@The Founder persona ymir`\n`@The Founder persona default` (reset)',
        inline: false
      },
      {
        name: 'Useful Commands',
        value: '`@The Founder persona list` - Show all personalities\n`@The Founder persona` - Show current personality\n`@The Founder persona reset` - Back to default',
        inline: false
      },
      {
        name: '⚙️ Info',
        value: 'Each personality has unique speech patterns and behavior\nPer-channel setting (different channels can have different personalities)\nConversation history resets when switching',
        inline: false
      }
    ],
    footer: { text: 'Each personality is canon-accurate to Attack on Titan' },
    timestamp: new Date()
  };
}

/**
 * Create AI Features Embed
 */
function createAIEmbed() {
  return {
    title: '💬 AI Chat Features',
    description: 'Powered by Google Gemini AI',
    color: 0xFF0000,
    fields: [
      {
        name: '🧠 Smart Memory System',
        value: 'Remembers 20-30+ conversation turns per channel\nBot remembers its own responses\nContext maintained across multiple messages\nSessions auto-clear after 48 hours',
        inline: false
      },
      {
        name: '💭 Natural Conversations',
        value: 'Advanced AI understanding\nContext-aware responses\nPersonality-matched replies\nSupports all active personalities',
        inline: false
      },
      {
        name: '📍 Auto-Reply Channel',
        value: `Channel: <#${botConfig?.aiChannelId || process.env.AI_CHANNEL_ID}>\nBot auto-responds to all messages\nNo mention needed - just chat naturally!\nBuilt-in 3-second cooldown for non-staff`,
        inline: false
      },
      {
        name: '⚙️ Performance',
        value: 'Response time: ~1 second\nAPI optimized: 50% fewer calls\nMemory efficient: 512MB RAM\nAlways online on Render',
        inline: false
      }
    ],
    footer: { text: 'Powered by Gemini 2.5 Flash Lite' },
    timestamp: new Date()
  };
}

/**
 * Create Game Commands Embed
 */
function createGameEmbed() {
  return {
    title: '🎮 Game Commands',
    description: 'Fun Attack on Titan themed commands for entertainment!',
    color: 0xFF0000,
    fields: [
      {
        name: '📊 survival [@user]',
        value: 'Calculate survival odds in AoT world\n**Usage:** `@The Founder survival @user`\n**Permission:** Anyone\n**Example:** Shows combat, strategy, speed, defense, strength & luck stats',
        inline: false
      },
      {
        name: '🔥 titan [@user]',
        value: 'Assign random Titan Shifter type\n**Usage:** `@The Founder titan @user`\n**Permission:** Anyone\n**Example:** Gives Colossal, Armored, Attack, or other Titan types',
        inline: false
      },
      {
        name: '📈 stats [@user]',
        value: 'Show AoT RPG-style stats\n**Usage:** `@The Founder stats @user`\n**Permission:** Anyone\n**Example:** Displays 8 stats, class, specialty, and rank',
        inline: false
      },
      {
        name: '💡 Tip',
        value: 'If you don\'t mention a user, the command targets you!',
        inline: false
      }
    ],
    footer: {
      text: 'These commands are just for fun!'
    },
    timestamp: new Date()
  };
}

/**
 * Create Server Status Embed
 */
function createStatusEmbed() {
  return {
    title: '📊 Bot & Server Status',
    description: 'Current deployment and features',
    color: 0xFF0000,
    fields: [
      {
        name: '✅ Bot Status',
        value: 'Status: **Online**\nUptime: Always active\nDeployment: Render (Free Tier)',
        inline: true
      },
      {
        name: '🔄 Rotating Status',
        value: 'Changes every 2 minutes\n12 unhinged AoT facts\nCheck bot profile to see them!',
        inline: true
      },
      {
        name: '🎮 Server Theme',
        value: 'Server: The Paradis Legion\nTheme: Attack on Titan\nCommunity: 200+ members',
        inline: true
      },
      {
        name: '📦 Resources',
        value: 'RAM: 512 MB (30% usage)\nAI Model: Gemini 2.5 Flash Lite\nBot Version: v2.0',
        inline: true
      },
      {
        name: '🚀 Features Active',
        value: '✅ Moderation commands\n✅ Personality switching\n✅ AI chat with memory\n✅ Rotating status\n✅ Staff logs',
        inline: false
      }
    ],
    footer: { text: 'Last updated: November 7, 2025' },
    timestamp: new Date()
  };
}


// --- Game Command Functions ---

/**
 * Generate survival embed
 * @param {User} targetUser - The user to generate the embed for
 * @returns {object} The embed object
 */
function generateSurvivalEmbed(targetUser) {
    // Generate random stats
    const combat = Math.floor(Math.random() * 100) + 1;
    const strategy = Math.floor(Math.random() * 100) + 1;
    const speed = Math.floor(Math.random() * 100) + 1;
    const defense = Math.floor(Math.random() * 100) + 1;
    const strength = Math.floor(Math.random() * 100) + 1;
    const luck = Math.floor(Math.random() * 100) + 1;

    // Calculate overall
    const overall = Math.floor((combat + strategy + speed + defense + strength + luck) / 6);

    // Determine verdict
    let verdict;
    if (overall <= 30) {
      verdict = "Unlikely to survive. Consider staying behind the walls.";
    } else if (overall <= 50) {
      verdict = "50/50 chance. Train harder, soldier!";
    } else if (overall <= 70) {
      verdict = "Decent odds. You'd make it with the right squad.";
    } else if (overall <= 85) {
      verdict = "High survival rate! You're Survey Corps material.";
    } else {
      verdict = "You're basically Levi. Humanity's hope!";
    }

    // Create embed
    return {
      title: `📊 ${targetUser.username}'s Survival Chance Analysis`,
      color: 0xFFA500,
      fields: [
        { name: '⚔️ Combat Skills', value: `${combat}/100`, inline: true },
        { name: '🧠 Strategic Thinking', value: `${strategy}/100`, inline: true },
        { name: '⚡ Speed & Reflexes', value: `${speed}/100`, inline: true },
        { name: '🛡️ Defense', value: `${defense}/100`, inline: true },
        { name: '💪 Physical Strength', value: `${strength}/100`, inline: true },
        { name: '🎯 Luck Factor', value: `${luck}/100`, inline: true },
        { name: '\u200B', value: '\u200B', inline: false }, // Spacer
        { name: '**Overall Survival Rate**', value: `**${overall}%**`, inline: false },
        { name: 'Verdict', value: verdict, inline: false }
      ],
      footer: { text: 'Results are randomly generated for entertainment' },
      timestamp: new Date()
    };
}

/**
 * Handle survival command (message-based)
 */
async function handleSurvivalCommand(message, args) {
  try {
    const targetUser = message.mentions.users.first() || message.author;
    const embed = generateSurvivalEmbed(targetUser);
    await message.reply({ embeds: [embed] });
    console.log(`[${new Date().toISOString()}] Survival command used for ${targetUser.username}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in survival command:`, error);
    await message.reply('❌ Error calculating survival odds. Try again!').catch(() => {});
  }
}

/**
 * Generate titan embed
 * @param {User} targetUser - The user to generate the embed for
 * @returns {object} The embed object
 */
function generateTitanEmbed(targetUser) {
    const titans = [
      { name: 'Colossal Titan', emoji: '🔥', height: '60 meters', ability: 'Steam emission & explosive transformation', weakness: 'Extremely slow movement speed', power: 95 },
      { name: 'Armored Titan', emoji: '🛡️', height: '15 meters', ability: 'Hardened armor plating', weakness: 'Reduced speed when armored', power: 88 },
      { name: 'Attack Titan', emoji: '⚔️', height: '15 meters', ability: 'Can see future memories & pure combat prowess', weakness: 'No special defensive abilities', power: 85 },
      { name: 'Female Titan', emoji: '💎', height: '14 meters', ability: 'Crystal hardening & calling Pure Titans', weakness: 'Limited stamina', power: 82 },
      { name: 'Beast Titan', emoji: '🦍', height: '17 meters', ability: 'Throwing accuracy & commanding Titans', weakness: 'Vulnerable nape', power: 90 },
      { name: 'Cart Titan', emoji: '🚂', height: '4 meters', ability: 'Endurance & equipment carrying', weakness: 'Low combat power', power: 65 },
      { name: 'Jaw Titan', emoji: '⚡', height: '5 meters', ability: 'Extreme speed & powerful jaws', weakness: 'Small size, fragile', power: 78 },
      { name: 'War Hammer Titan', emoji: '🔨', height: '15 meters', ability: 'Create weapons from hardening', weakness: 'Requires concentration', power: 92 },
      { name: 'Founding Titan', emoji: '👑', height: 'Variable', ability: 'Control all Titans & alter Eldian bodies', weakness: 'Requires royal blood to use fully', power: 100 }
    ];

    const selectedTitan = titans[Math.floor(Math.random() * titans.length)];

    return {
      title: `${selectedTitan.emoji} ${targetUser.username} has inherited the ${selectedTitan.name}!`,
      color: 0xFF0000,
      fields: [
        { name: 'Height', value: selectedTitan.height, inline: true },
        { name: 'Power Level', value: `${selectedTitan.power}/100`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }, // Spacer
        { name: 'Ability', value: selectedTitan.ability, inline: false },
        { name: 'Weakness', value: selectedTitan.weakness, inline: false }
      ],
      footer: { text: '"With great power comes great responsibility. Use it wisely, soldier."' },
      timestamp: new Date()
    };
}

/**
 * Handle titan command (message-based)
 */
async function handleTitanCommand(message, args) {
  try {
    const targetUser = message.mentions.users.first() || message.author;
    const embed = generateTitanEmbed(targetUser);
    await message.reply({ embeds: [embed] });
    console.log(`[${new Date().toISOString()}] Titan command used for ${targetUser.username}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in titan command:`, error);
    await message.reply('❌ Error assigning Titan. Try again!').catch(() => {});
  }
}

/**
 * Generate stats embed
 * @param {User} targetUser - The user to generate the embed for
 * @returns {object} The embed object
 */
function generateStatsEmbed(targetUser) {
    const combat = Math.floor(Math.random() * 100) + 1;
    const strategy = Math.floor(Math.random() * 100) + 1;
    const speed = Math.floor(Math.random() * 100) + 1;
    const defense = Math.floor(Math.random() * 100) + 1;
    const strength = Math.floor(Math.random() * 100) + 1;
    const accuracy = Math.floor(Math.random() * 100) + 1;
    const stamina = Math.floor(Math.random() * 100) + 1;
    const leadership = Math.floor(Math.random() * 100) + 1;

    const total = combat + strategy + speed + defense + strength + accuracy + stamina + leadership;

    const stats = { combat, strategy, speed, defense, strength, accuracy, stamina, leadership };
    const maxStat = Math.max(...Object.values(stats));
    let characterClass, specialty;

    if (maxStat === combat || maxStat === strength) {
      characterClass = 'Warrior';
      specialty = 'Close-quarters combat & raw power';
    } else if (maxStat === strategy || maxStat === leadership) {
      characterClass = 'Commander';
      specialty = 'Tactical planning & leadership';
    } else if (maxStat === speed || maxStat === accuracy) {
      characterClass = 'Elite Scout';
      specialty = 'High-speed combat & precision strikes';
    } else if (maxStat === defense || maxStat === stamina) {
      characterClass = 'Guardian';
      specialty = 'Defense & endurance';
    } else {
      characterClass = 'All-Rounder';
      specialty = 'Balanced abilities across all fields';
    }

    let rank;
    if (total <= 300) { rank = 'Trainee'; }
    else if (total <= 450) { rank = 'Soldier'; }
    else if (total <= 550) { rank = 'Veteran Soldier'; }
    else if (total <= 650) { rank = 'Elite Soldier'; }
    else if (total <= 750) { rank = 'Squad Leader'; }
    else { rank = 'Commander'; }

    return {
      title: `📊 ${targetUser.username}'s Attack on Titan Stats`,
      color: 0x0099FF,
      fields: [
        { name: '⚔️ Combat Power', value: `${combat}/100`, inline: true },
        { name: '🧠 Strategic Mind', value: `${strategy}/100`, inline: true },
        { name: '⚡ Speed & Agility', value: `${speed}/100`, inline: true },
        { name: '🛡️ Defense', value: `${defense}/100`, inline: true },
        { name: '💪 Raw Strength', value: `${strength}/100`, inline: true },
        { name: '🎯 Accuracy', value: `${accuracy}/100`, inline: true },
        { name: '🔋 Stamina', value: `${stamina}/100`, inline: true },
        { name: '💡 Leadership', value: `${leadership}/100`, inline: true },
        { name: '\u200B', value: '\u200B', inline: false }, // Spacer
        { name: '**Total Power**', value: `**${total}/800**`, inline: false },
        { name: 'Class', value: characterClass, inline: true },
        { name: 'Rank', value: rank, inline: true },
        { name: 'Specialty', value: specialty, inline: false }
      ],
      footer: { text: '"Your stats show promise. Keep training, soldier!"' },
      timestamp: new Date()
    };
}

/**
 * Handle stats command (message-based)
 */
async function handleStatsCommand(message, args) {
  try {
    const targetUser = message.mentions.users.first() || message.author;
    const embed = generateStatsEmbed(targetUser);
    await message.reply({ embeds: [embed] });
    console.log(`[${new Date().toISOString()}] Stats command used for ${targetUser.username}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in stats command:`, error);
    await message.reply('❌ Error generating stats. Try again!').catch(() => {});
  }
}


// --- Slash Command Handlers ---

async function handleSlashPurge(interaction) {
  const amount = interaction.options.getInteger('amount');
  const staffRoleId = process.env.STAFF_ROLE_ID;

  // Check staff permission
  if (!interaction.member.roles.cache.has(staffRoleId)) {
    return interaction.reply({
      content: '❌ This command is staff only.',
      ephemeral: true
    });
  }

  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);

    await interaction.reply({
      content: `✅ Successfully deleted ${deleted.size} messages.`,
      ephemeral: true
    });
  } catch (error) {
    await interaction.reply({
      content: '❌ Failed to delete messages. They might be too old (14+ days).',
      ephemeral: true
    });
  }
}

async function handleSlashWarn(interaction) {
  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const staffRoleId = process.env.STAFF_ROLE_ID;
  const staffLogChannel = process.env.STAFF_LOG_CHANNEL;

  // Check staff permission
  if (!interaction.member.roles.cache.has(staffRoleId)) {
    return interaction.reply({
      content: '❌ This command is staff only.',
      ephemeral: true
    });
  }

  // Check if target is staff
  const targetMember = interaction.guild.members.cache.get(targetUser.id);
  if (targetMember?.roles.cache.has(staffRoleId)) {
    return interaction.reply({
      content: '❌ You cannot warn staff members.',
      ephemeral: true
    });
  }

  // Check if target is bot
  if (targetUser.bot) {
    return interaction.reply({
      content: '❌ You cannot warn bots.',
      ephemeral: true
    });
  }

  // Create warning embed
  const warnEmbed = {
    title: '⚠️ Rule Violation Warning',
    description: `Attention **${targetUser.tag}**, a warning has been issued for **${reason}**.

Please review the server rules to ensure compliance and maintain a positive environment for all Legionaries. This is a reminder to uphold the standards that make our community strong.`,
    color: 0xFFA500,
    footer: { text: 'Stay vigilant, Legionaries!' },
    timestamp: new Date()
  };

  await interaction.reply({ embeds: [warnEmbed] });

  // Log to staff channel
  const logChannel = interaction.guild.channels.cache.get(staffLogChannel);
  if (logChannel) {
    const logEmbed = {
      title: '📋 Warning Issued',
      fields: [
        { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      color: 0xFFA500,
      timestamp: new Date()
    };

    await logChannel.send({ embeds: [logEmbed] });
  }
}

async function handleSlashSay(interaction) {
  const message = interaction.options.getString('message');

  await interaction.channel.send({ content: message });
  await interaction.reply({ content: '✅ Message sent.', ephemeral: true });
}

async function handleSlashAnnounce(interaction) {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (!interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.reply({
            content: '❌ **Access Denied:** You need the Staff role to use this command.',
            ephemeral: true
        });
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const footerText = interaction.options.getString('footer') || `Announcement by ${interaction.user.username}`;
    const showAvatar = interaction.options.getBoolean('show_avatar') || false;

    const dateString = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const announceEmbed = {
        color: 0x5ab55e,
        title: title,
        description: description,
        thumbnail: {
            url: 'https://cdn.discordapp.com/attachments/1407687724575625326/1413917446880100383/2.png?ex=691163fc&is=6910127c&hm=32c17ae8f2b69b50cf05de32606228558c1b1e33611855c5e615bbad8f9dc404&'
        },
        footer: {
            text: `${footerText} • 📢 Announced on ${dateString}`
        },
        timestamp: new Date().toISOString(),
    };

    if (showAvatar) {
        announceEmbed.author = {
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL()
        };
    }

    try {
        await interaction.reply({ embeds: [announceEmbed] });
    } catch (error) {
        console.error("Failed to send slash announcement:", error);
        await interaction.followUp({ content: '❌ **Error:** Failed to send announcement. Please try again.', ephemeral: true });
    }
}

async function handleSlashSummon(interaction) {
  const targetUser = interaction.options.getUser('user');

  try {
    const prompt = `Generate a dramatic, medieval-style summon message for ${targetUser.username}. Make it theatrical, over-the-top, and mention them 3-4 times. Use "thee", "thou", "hath" etc. Keep it under 200 words.`;

    const result = await model.generateContent(prompt);
    const summonText = result.response.text();

    await interaction.editReply(`${targetUser} ${summonText}`);

  } catch (error) {
    await interaction.editReply('❌ Failed to generate summon message.');
  }
}

async function handleSlashPersona(interaction) {
  const name = interaction.options.getString('name');
  const action = interaction.options.getString('action');
  const channelId = interaction.channelId;

  // Handle list action
  if (action === 'list') {
    const listEmbed = createPersonaListEmbed();
    return interaction.reply({ embeds: [listEmbed], ephemeral: true });
  }

  // Handle reset action
  if (action === 'reset' || name === 'default') {
    currentPersonalities.set(channelId, 'default');
    clearChatSession(channelId);

    return interaction.reply('🤖 Personality reset to **The Founder** (default)!\nConversation history cleared.');
  }

  // If no name provided, show current
  if (!name) {
    const current = currentPersonalities.get(channelId) || 'default';
    const emoji = personalityEmojis[current] || '🤖';
    const desc = descriptions[current] || 'The Founder';

    return interaction.reply({
      content: `Current personality: ${emoji} **${current}** - ${desc}`,
      ephemeral: true
    });
  }

  // Switch personality
  if (availablePersonalities.includes(name)) {
    currentPersonalities.set(channelId, name);
    clearChatSession(channelId);

    const emoji = personalityEmojis[name];
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    await interaction.reply(`${emoji} Personality switched to **${formattedName}**!\nConversation history reset.`);
  } else {
    await interaction.reply({
      content: '❌ Invalid personality. Use `/persona` with action "list" to see available options.',
      ephemeral: true
    });
  }
}

async function handleSlashHelp(interaction) {
  const category = interaction.options.getString('category') || 'overview';

  let embeds = [];

  switch (category) {
    case 'moderation':
      embeds = [createModerationEmbed()];
      break;
    case 'persona':
      embeds = [createPersonaEmbed()];
      break;
    case 'ai':
      embeds = [createAIEmbed()];
      break;
    case 'game':
      embeds = [createGameEmbed()];
      break;
    case 'management':
      embeds = [createBotManagementEmbed()];
      break;
    case 'all':
      embeds = [
        createOverviewEmbed(),
        createModerationEmbed(),
        createPersonaEmbed(),
        createAIEmbed(),
        createGameEmbed(),
        createFunEmbed(),
        createBotManagementEmbed(),
        createStatusEmbed()
      ];
      break;
    case 'overview':
    default:
      embeds = [createOverviewEmbed()];
      break;
  }

  await interaction.reply({ embeds: embeds });
}

async function handleSlashSurvival(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  const embed = generateSurvivalEmbed(targetUser);

  await interaction.reply({ embeds: [embed] });
}

async function handleSlashTitan(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  const embed = generateTitanEmbed(targetUser);

  await interaction.reply({ embeds: [embed] });
}

async function handleSlashStats(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  const embed = generateStatsEmbed(targetUser);

  await interaction.reply({ embeds: [embed] });
}

// --- New Roast Command Handlers ---
async function handleSlashRoast(interaction) {
    if (roastDisabled) {
        return interaction.reply({ content: '🔒 Roast mode is currently disabled.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    if (roastBlacklist.includes(targetUser.id)) {
        return interaction.reply({ content: `🛡️ ${targetUser.username} is protected from roasts.`, ephemeral: true });
    }

    const intensity = interaction.options.getString('intensity') || 'mild';
    const intensityColors = {
        mild: 0xFFFF00, // Yellow
        medium: 0xFFA500, // Orange
        spicy: 0xFF4500, // OrangeRed
        hardcore: 0x8B0000 // DarkRed
    };

    try {
        await interaction.deferReply();
        const prompt = `Generate a ${intensity} roast for a Discord user named "${targetUser.username}". Keep it funny and creative. ${intensity === 'hardcore' ? 'Push the limits but stay within a PG rating.' : ''} Max 2 sentences.`;
        const result = await model.generateContent(prompt);
        const roastText = result.response.text();

        const embed = {
            color: intensityColors[intensity],
            description: `**${roastText}**`,
            footer: { text: `A ${intensity} roast for ${targetUser.username}` }
        };

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("Roast command error:", error);
        await interaction.editReply({ content: '❌ Could not generate roast. The AI might be having a moment.', ephemeral: true });
    }
}

async function handleSlashRoastDisable(interaction) {
    roastDisabled = !roastDisabled;
    const status = roastDisabled ? '🔒 Roast mode disabled. No roasts will be processed.' : '🔓 Roast mode re-enabled. Let the chaos begin!';
    await interaction.reply({ content: status, ephemeral: true });
}

async function handleSlashRoastBlacklist(interaction) {
    const userId = interaction.user.id;
    const index = roastBlacklist.indexOf(userId);

    if (index > -1) {
        roastBlacklist.splice(index, 1);
        await interaction.reply({ content: "✅ You've been removed from the roast blacklist and can be targeted again.", ephemeral: true });
    } else {
        roastBlacklist.push(userId);
        await interaction.reply({ content: "🛡️ You're now protected from roasts. You cannot be targeted.", ephemeral: true });
    }
}

// --- New Gaslighting Command Handlers ---
async function handleSlashMandela(interaction) {
    gaslightingActive = true;
    chatSessions.clear(); // Force reload of system instructions

    const fakeEvent = interaction.options.getString('fake_event');
    try {
        await interaction.deferReply();
        const prompt = `Create an obviously fictional memory about this event happening on a Discord server: "${fakeEvent}". Insist it definitely happened. Add fake details. Keep it absurd and clearly fake. Max 3 sentences.`;
        const result = await model.generateContent(prompt);
        const mandelaText = result.response.text();

        const embed = {
            color: 0x7289DA, // Discord Blurple
            title: 'A Memory Jog...',
            description: mandelaText,
            footer: { text: '🎭 Fictional Memory Mode Active' }
        };
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("Mandela command error:", error);
        await interaction.editReply({ content: '❌ Could not generate the fake event.', ephemeral: true });
    }
}

async function handleSlashFakeHistory(interaction) {
    gaslightingActive = true;
    chatSessions.clear();

    const targetUser = interaction.options.getUser('user');
    try {
        await interaction.deferReply();
        const prompt = `Create a completely fake, lighthearted history for a Discord user named "${targetUser.username}". Include an absurd join date, fake achievements, and ridiculous records. Make it obviously fictional. Max 4 sentences.`;
        const result = await model.generateContent(prompt);
        const historyText = result.response.text();

        const embed = {
            color: 0x99AAB5, // Discord Greyple
            title: `The Secret History of ${targetUser.username}`,
            description: historyText,
            footer: { text: '🎭 Fictional History Mode Active' }
        };
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("Fake history command error:", error);
        await interaction.editReply({ content: '❌ Could not generate the fake history.', ephemeral: true });
    }
}

async function handleSlashGaslightReset(interaction) {
    gaslightingActive = false;
    chatSessions.clear();
    await interaction.reply({ content: '✅ Gaslighting mode deactivated. The bot has returned to normal behavior and all chat sessions have been reset.', ephemeral: true });
}

async function handleSlashControl(interaction) {
  const staffRoleId = process.env.STAFF_ROLE_ID;

  // Staff permission check
  if (!interaction.member.roles.cache.has(staffRoleId)) {
    return interaction.reply({
      content: '❌ **Access Denied:** This command requires Staff permissions.',
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'toggle-bot': {
        const state = interaction.options.getBoolean('state');
        botConfig.botEnabled = state;
        saveConfig(botConfig);
        await interaction.reply({
          content: `✅ Bot ${state ? '**enabled**' : '**disabled**'} successfully.`,
          ephemeral: true
        });
        break;
      }

      case 'set-ai-channel': {
        const channel = interaction.options.getChannel('channel');
        botConfig.aiChannelId = channel.id;
        saveConfig(botConfig);
        await interaction.reply({
          content: `✅ AI auto-reply channel set to ${channel}`,
          ephemeral: true
        });
        break;
      }

      case 'set-cooldown': {
        const value = interaction.options.getInteger('value');
        const unit = interaction.options.getString('unit');

        botConfig.cooldownTime = value;
        botConfig.cooldownUnit = unit;
        saveConfig(botConfig);

        // Apply to global COOLDOWN_TIME constant
        const multiplier = unit === 'minutes' ? 60000 : 1000;
        global.COOLDOWN_TIME = value * multiplier;

        await interaction.reply({
          content: `✅ Cooldown set to **${value} ${unit}** (applies immediately)`,
          ephemeral: true
        });
        break;
      }

      case 'set-session-timeout': {
        const value = interaction.options.getInteger('value');
        const unit = interaction.options.getString('unit');

        botConfig.sessionTimeout = value;
        botConfig.sessionTimeoutUnit = unit;
        saveConfig(botConfig);

        // Apply to global SESSION_TIMEOUT constant
        const multiplier = unit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
        global.SESSION_TIMEOUT = value * multiplier;

        await interaction.reply({
          content: `✅ Session timeout set to **${value} ${unit}** (applies to new sessions)`,
          ephemeral: true
        });
        break;
      }

      case 'set-personality-default': {
        const channel = interaction.options.getChannel('channel');
        const personality = interaction.options.getString('personality');

        botConfig.personalityDefaults[channel.id] = personality;
        saveConfig(botConfig);

        // Apply immediately
        currentPersonalities.set(channel.id, personality);
        clearChatSession(channel.id);

        await interaction.reply({
          content: `✅ Default personality for ${channel} set to **${personality}** (applied immediately)`,
          ephemeral: true
        });
        break;
      }

      case 'disable-commands': {
        const category = interaction.options.getString('category');
        const enable = interaction.options.getBoolean('enable');

        if (enable) {
          // Remove from disabled list
          botConfig.disabledCommands = botConfig.disabledCommands.filter(c => c !== category);
        } else {
          // Add to disabled list
          if (!botConfig.disabledCommands.includes(category)) {
            botConfig.disabledCommands.push(category);
          }
        }

        saveConfig(botConfig);

        // Filter commands based on disabled categories
        const categoryMap = {
          'game': ['survival', 'titan', 'stats'],
          'fun': ['roast', 'roast-disable', 'roast-blacklist', 'mandela', 'fake-history', 'gaslight-reset'],
          'persona': ['persona']
        };

        let commandsToRegister = [...slashCommands];

        // Apply filtering based on ALL disabled categories in config
        if (botConfig.disabledCommands && botConfig.disabledCommands.length > 0) {
          botConfig.disabledCommands.forEach(disabledCat => {
            if (disabledCat === 'all') {
              // Keep only essential commands
              commandsToRegister = slashCommands.filter(cmd =>
                ['purge', 'warn', 'announce', 'help', 'control'].includes(cmd.name)
              );
            } else {
              // Filter by category
              const disabledCmds = categoryMap[disabledCat] || [];
              commandsToRegister = commandsToRegister.filter(cmd =>
                !disabledCmds.includes(cmd.name)
              );
            }
          });
        }

        const guild = interaction.guild;
        await guild.commands.set(commandsToRegister);

        await interaction.reply({
          content: `✅ Command category **${category}** ${enable ? 'enabled' : 'disabled'}. Commands ${enable ? 'restored' : 'hidden'}.`,
          ephemeral: true
        });
        break;
      }

      case 'rate-limit': {
        const enabled = interaction.options.getBoolean('enabled');
        const maxRequests = interaction.options.getInteger('max_requests');
        const timeWindow = interaction.options.getInteger('time_window');

        botConfig.rateLimitSettings.enabled = enabled;
        if (maxRequests !== null) botConfig.rateLimitSettings.maxRequests = maxRequests;
        if (timeWindow !== null) botConfig.rateLimitSettings.timeWindow = timeWindow;

        saveConfig(botConfig);

        await interaction.reply({
          content: `✅ Rate limiting ${enabled ? 'enabled' : 'disabled'}` +
            (maxRequests ? `\n• Max requests: **${maxRequests}**` : '') +
            (timeWindow ? `\n• Time window: **${timeWindow}s**` : ''),
          ephemeral: true
        });
        break;
      }

      case 'auto-mod': {
        const feature = interaction.options.getString('feature');
        const state = interaction.options.getBoolean('state');

        botConfig.autoModeration[feature] = state;
        saveConfig(botConfig);

        await interaction.reply({
          content: `✅ Auto-moderation feature **${feature}** ${state ? 'enabled' : 'disabled'}`,
          ephemeral: true
        });
        break;
      }

      case 'view-config': {
        const embed = {
          title: '⚙️ Bot Configuration Dashboard',
          color: 0x00FF00,
          fields: [
            {
              name: '🤖 Bot Status',
              value: botConfig.botEnabled ? '✅ **Enabled**' : '❌ **Disabled**',
              inline: true
            },
            {
              name: '💬 AI Channel',
              value: `<#${botConfig.aiChannelId}>`,
              inline: true
            },
            {
              name: '⏱️ Cooldown',
              value: `${botConfig.cooldownTime} ${botConfig.cooldownUnit}`,
              inline: true
            },
            {
              name: '🕐 Session Timeout',
              value: `${botConfig.sessionTimeout} ${botConfig.sessionTimeoutUnit}`,
              inline: true
            },
            {
              name: '📊 Active Sessions',
              value: `${chatSessions.size} sessions`,
              inline: true
            },
            {
              name: '📺 Status Messages',
              value: `${botConfig.statusMessages.length} loaded`,
              inline: true
            },
            {
              name: '🎭 Personality Defaults',
              value: Object.keys(botConfig.personalityDefaults).length > 0
                ? Object.entries(botConfig.personalityDefaults)
                    .map(([chId, pers]) => `<#${chId}>: ${pers}`)
                    .join('\n')
                : 'None set',
              inline: false
            },
            {
              name: '🚫 Disabled Commands',
              value: botConfig.disabledCommands.length > 0
                ? botConfig.disabledCommands.join(', ')
                : 'None',
              inline: false
            },
            {
              name: '⚡ Rate Limiting',
              value: `${botConfig.rateLimitSettings.enabled ? '✅' : '❌'} Enabled` +
                `\n• Max: ${botConfig.rateLimitSettings.maxRequests} requests` +
                `\n• Window: ${botConfig.rateLimitSettings.timeWindow}s`,
              inline: true
            },
            {
              name: '🛡️ Auto-Moderation',
              value: `${botConfig.autoModeration.enabled ? '✅' : '❌'} System` +
                `\n${botConfig.autoModeration.deleteSpam ? '✅' : '❌'} Delete Spam` +
                `\n${botConfig.autoModeration.warnOnCaps ? '✅' : '❌'} Warn on Caps`,
              inline: true
            }
          ],
          footer: { text: 'Use /control commands to modify these settings' },
          timestamp: new Date()
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'clear-sessions': {
        const count = chatSessions.size;
        chatSessions.clear();
        await interaction.reply({
          content: `✅ Cleared **${count}** active AI chat sessions.`,
          ephemeral: true
        });
        break;
      }

      case 'add-status': {
        const message = interaction.options.getString('message');
        botConfig.statusMessages.push(message);
        saveConfig(botConfig);
        await interaction.reply({
          content: `✅ Added status message: "${message}"\nTotal: ${botConfig.statusMessages.length} messages`,
          ephemeral: true
        });
        break;
      }

      case 'remove-status': {
        const index = interaction.options.getInteger('index');
        if (index >= botConfig.statusMessages.length) {
          return interaction.reply({
            content: `❌ Invalid index. There are only ${botConfig.statusMessages.length} status messages.`,
            ephemeral: true
          });
        }
        const removed = botConfig.statusMessages.splice(index, 1);
        saveConfig(botConfig);
        await interaction.reply({
          content: `✅ Removed status message: "${removed[0]}"\nRemaining: ${botConfig.statusMessages.length} messages`,
          ephemeral: true
        });
        break;
      }

      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          ephemeral: true
        });
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in control command:`, error);
    await interaction.reply({
      content: '❌ An error occurred while processing your request.',
      ephemeral: true
    });
  }
}

// Message Create Event
client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot || !message.guild || !botConfig.botEnabled) return;

        // --- AoTR Q&A Handler ---
        if (message.channel.id === process.env.AOTR_INFO_CHANNEL_ID) {
            aotrHandler.handleMessage(message);
            return; // Stop further processing
        }

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

            // D) ANNOUNCE COMMAND
            if (command === 'announce') {
                if (!isStaff) {
                    const errorMsg = await message.reply('❌ **Access Denied:** You need the Staff role to use this command.');
                    setTimeout(() => {
                        errorMsg.delete().catch(() => {});
                        message.delete().catch(() => {});
                    }, 5000);
                    return;
                }

                const rawContent = commandContent.substring(command.length).trim();
                const parts = rawContent.split('||').map(p => p.trim());

                const title = parts[0];
                const description = parts[1];
                const footerText = parts[2] || `Announcement by ${message.author.username}`;
                const showAvatar = parts[3]?.toLowerCase() === 'yes';

                if (!title || !description) {
                    const usageMsg = await message.reply('❌ **Usage:** `announce <title> || <description> || [footer] || [author_avatar: yes/no]`');
                    setTimeout(() => {
                        usageMsg.delete().catch(() => {});
                        message.delete().catch(() => {});
                    }, 10000);
                    return;
                }

                const dateString = new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                const announceEmbed = {
                    color: 0x5ab55e,
                    title: title,
                    description: description,
                    thumbnail: {
                        url: 'https://cdn.discordapp.com/attachments/1407687724575625326/1413917446880100383/2.png?ex=691163fc&is=6910127c&hm=32c17ae8f2b69b50cf05de32606228558c1b1e33611855c5e615bbad8f9dc404&'
                    },
                    footer: {
                        text: `${footerText} • 📢 Announced on ${dateString}`
                    },
                    timestamp: new Date().toISOString(),
                };

                if (showAvatar) {
                    announceEmbed.author = {
                        name: message.author.username,
                        iconURL: message.author.displayAvatarURL()
                    };
                }

                try {
                    await message.delete();
                    await message.channel.send({ embeds: [announceEmbed] });
                } catch (error) {
                    console.error("Failed to send announcement:", error);
                    await message.channel.send('❌ **Error:** Failed to send announcement. Please try again.');
                }
                return;
            }

            // E) SUMMON COMMAND
            if (command === 'summon') {
                await handleSummonCommand(message);
                return;
            }

            // F) RESET COMMAND
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

            // G) PERSONA COMMAND
            if (command === 'persona') {
                await handlePersonaCommand(message, args);
                return;
            }

            // H) HELP COMMAND
            if (command === 'help') {
                await handleHelpCommand(message, commandContent);
                return;
            }

            // --- Game Commands ---
            if (command === 'survival') {
              await handleSurvivalCommand(message, args);
              return;
            }

            if (command === 'titan') {
              await handleTitanCommand(message, args);
              return;
            }

            if (command === 'stats') {
              await handleStatsCommand(message, args);
              return;
            }
        }

        // --- AI Auto-Reply ---
        if (message.channel.id === (botConfig?.aiChannelId || process.env.AI_CHANNEL_ID)) {
            if (!isStaff) { // Apply cooldown only to non-staff
                if (cooldowns.has(message.author.id)) {
                    const expirationTime = cooldowns.get(message.author.id) + global.COOLDOWN_TIME;
                    if (Date.now() < expirationTime) return; // Silently ignore
                }
                cooldowns.set(message.author.id, Date.now());
                setTimeout(() => cooldowns.delete(message.author.id), global.COOLDOWN_TIME);
            }
            await handleAIResponse(message);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in messageCreate handler:`, error);
        message.reply('❌ An error occurred while processing your request. Please try again.').catch(console.error);
    }
});


/**
 * Update bot status with rotating unhinged AoT facts
 */
function updateStatus() {
  const statuses = botConfig?.statusMessages || [];
  if (statuses.length === 0) return;

  const status = statuses[currentStatusIndex];

  client.user.setPresence({
    activities: [{
      name: status,
      type: 4 // Custom status
    }],
    status: 'online'
  });

  console.log(`[${new Date().toISOString()}] 📺 Status updated: ${status}`);

  // Move to next status (cycle back to start at end)
  currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
}

// 7. Bot Ready Event
client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);

  // Load dynamic config values
  const cooldownMultiplier = botConfig.cooldownUnit === 'minutes' ? 60000 : 1000;
  global.COOLDOWN_TIME = botConfig.cooldownTime * cooldownMultiplier;

  const sessionMultiplier = botConfig.sessionTimeoutUnit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  global.SESSION_TIMEOUT = botConfig.sessionTimeout * sessionMultiplier;

  console.log(`✅ Using gemini-2.5-flash-lite model`);

  aotrHandler.initialize();

  // === SLASH COMMAND REGISTRATION ===
  try {
    const guild = client.guilds.cache.get(GUILD_ID);

    if (guild) {
      console.log('📡 Registering slash commands...');

      // Filter commands based on disabled categories
      const categoryMap = {
        'game': ['survival', 'titan', 'stats'],
        'fun': ['roast', 'roast-disable', 'roast-blacklist', 'mandela', 'fake-history', 'gaslight-reset'],
        'persona': ['persona']
      };

      let commandsToRegister = [...slashCommands];

      if (botConfig.disabledCommands && botConfig.disabledCommands.length > 0) {
        botConfig.disabledCommands.forEach(category => {
          if (category === 'all') {
            // Keep only essential commands
            commandsToRegister = slashCommands.filter(cmd =>
              ['purge', 'warn', 'announce', 'help', 'control'].includes(cmd.name)
            );
          } else {
            // Filter by category
            const disabledCmds = categoryMap[category] || [];
            commandsToRegister = commandsToRegister.filter(cmd =>
              !disabledCmds.includes(cmd.name)
            );
          }
        });
      }

      await guild.commands.set(commandsToRegister);

      console.log(`✅ Successfully registered ${commandsToRegister.length} slash commands!`);
      console.log('✅ Commands available instantly in The Paradis Legion');
    } else {
      console.warn('⚠️ Guild not found for slash command registration');
    }
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
  // === END SLASH COMMAND REGISTRATION ===

  // Start status rotation
  updateStatus(); // Set initial status
  setInterval(updateStatus, 120000); // Rotate every 2 minutes

  console.log(`✅ Status rotation started (changes every 2 minutes).`);

  setInterval(() => {
    cleanupOldSessions();
  }, CLEANUP_INTERVAL);

  console.log(`✅ Session cleanup scheduled (runs every ${CLEANUP_INTERVAL / 1000 / 60} minutes)`);
  console.log(`✅ Bot is ready! Monitoring channel: ${botConfig?.aiChannelId || process.env.AI_CHANNEL_ID}`);
});

client.on('interactionCreate', async (interaction) => {
  // Only handle slash commands
  if (!interaction.isCommand()) return;

  const { commandName, options, user, member, channel, guild } = interaction;

  try {
    // Check if command should be deferred (for slow operations)
    const shouldDefer = ['summon'].includes(commandName);

    if (shouldDefer) {
      await interaction.deferReply();
    }

    // Route to appropriate handler
    switch (commandName) {
      case 'purge':
        await handleSlashPurge(interaction);
        break;

      case 'warn':
        await handleSlashWarn(interaction);
        break;

      case 'say':
        await handleSlashSay(interaction);
        break;

      case 'announce':
        await handleSlashAnnounce(interaction);
        break;

      case 'summon':
        await handleSlashSummon(interaction);
        break;

      case 'persona':
        await handleSlashPersona(interaction);
        break;

      case 'help':
        await handleSlashHelp(interaction);
        break;

      case 'survival':
        await handleSlashSurvival(interaction);
        break;

      case 'titan':
        await handleSlashTitan(interaction);
        break;

      case 'stats':
        await handleSlashStats(interaction);
        break;

      case 'roast':
        await handleSlashRoast(interaction);
        break;

      case 'roast-disable':
        await handleSlashRoastDisable(interaction);
        break;

      case 'roast-blacklist':
        await handleSlashRoastBlacklist(interaction);
        break;

      case 'mandela':
        await handleSlashMandela(interaction);
        break;

      case 'fake-history':
        await handleSlashFakeHistory(interaction);
        break;

      case 'gaslight-reset':
        await handleSlashGaslightReset(interaction);
        break;

      case 'control':
        await handleSlashControl(interaction);
        break;

      default:
        await interaction.reply({
          content: '❌ Unknown command',
          ephemeral: true
        });
    }

    console.log(`[${new Date().toISOString()}] Slash command used: /${commandName} by ${user.tag}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error handling slash command:`, error);

    const errorMessage = {
      content: '❌ An error occurred while executing this command.',
      ephemeral: true
    };

    if (interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else if (!interaction.replied) {
      await interaction.reply(errorMessage);
    }
  }
});

// 8. Bot Login
client.login(process.env.DISCORD_TOKEN);
