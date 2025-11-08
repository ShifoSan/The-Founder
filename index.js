// 1. Load environment variables
require('dotenv').config();

// 2. Import required modules
const fs = require('fs');
const path = require('path');

// AoT Facts for rotating status
const aotStatuses = [
  "⚔️ Armin's bullies crushed by debris seconds after Colossal Titan breached Wall Maria",
  "🍷 Isayama created Titans after drunk grabbed him at internet cafe, inspired by fear",
  "🌀 Number 13 cursed: Titan lifespan, Wall Maria yr 845÷13, 104th Corps÷13, Erwin 13th",
  "👁️ Attack Titan has mysterious 3rd eyelid that appears only once in the entire series",
  "🧠 Reiner transferred consciousness from human body to Titan nervous system to survive",
  "🥔 Sasha was supposed to die Volume 9, Clash of Titans but Isayama changed his mind",
  "🗺️ AoT world geography inverted: Paradis = Madagascar, Marley = Africa upside down",
  "💀 Armin's first kill was human soldier, not Titan—ironic for 'Attack on Titan'",
  "👓 Hanji's eyesight so bad she can't tell Jean apart from Reiner without glasses",
  "💁 Isayama designed Historia's appearance & personality before deciding her story",
  "📉 Ymir sabotaged training so Historia would rank in top 10 graduates instead",
  "🦗 Early manga Scouts leaped 10m like grasshoppers, no ODM gear used back then"
];

let currentStatusIndex = 0;
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const aotrHandler = require('./aotr-handler.js');

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
      case 'all':
        embeds = [
          createOverviewEmbed(),
          createModerationEmbed(),
          createPersonaEmbed(),
          createAIEmbed(),
          createGameEmbed(),
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
function createOverviewEmbed() {
  return {
    title: '🤖 The Founder Bot - Complete Guide',
    description: 'Your AI-powered moderation and personality-switching assistant!',
    color: 0xFF0000, // Red
    fields: [
      {
        name: '🛡️ Moderation Commands',
        value: '`purge` `warn` `say` `summon`\n\nType: `@The Founder help moderation`',
        inline: false
      },
      {
        name: '🎮 Game Commands',
        value: '`survival` `titan` `stats`\n\nType: `@The Founder help game`',
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
        value: `Channel: <#${process.env.AI_CHANNEL_ID}>\nBot auto-responds to all messages\nNo mention needed - just chat naturally!\nBuilt-in 3-second cooldown for non-staff`,
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
        value: 'Server: The Paradis Legion\nTheme: Attack on Titan\nCommunity: 500+ members',
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
 * Handle survival command
 */
async function handleSurvivalCommand(message, args) {
  try {
    // Determine target user
    const targetUser = message.mentions.users.first() || message.author;

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
    const embed = {
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

    await message.reply({ embeds: [embed] });
    console.log(`[${new Date().toISOString()}] Survival command used for ${targetUser.username}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in survival command:`, error);
    await message.reply('❌ Error calculating survival odds. Try again!').catch(() => {});
  }
}

/**
 * Handle titan command
 */
async function handleTitanCommand(message, args) {
  try {
    // Determine target user
    const targetUser = message.mentions.users.first() || message.author;

    // Titan types array
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

    // Random selection
    const selectedTitan = titans[Math.floor(Math.random() * titans.length)];

    // Create embed
    const embed = {
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

    await message.reply({ embeds: [embed] });
    console.log(`[${new Date().toISOString()}] Titan command used: ${selectedTitan.name} for ${targetUser.username}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in titan command:`, error);
    await message.reply('❌ Error assigning Titan. Try again!').catch(() => {});
  }
}

/**
 * Handle stats command
 */
async function handleStatsCommand(message, args) {
  try {
    // Determine target user
    const targetUser = message.mentions.users.first() || message.author;

    // Generate random stats
    const combat = Math.floor(Math.random() * 100) + 1;
    const strategy = Math.floor(Math.random() * 100) + 1;
    const speed = Math.floor(Math.random() * 100) + 1;
    const defense = Math.floor(Math.random() * 100) + 1;
    const strength = Math.floor(Math.random() * 100) + 1;
    const accuracy = Math.floor(Math.random() * 100) + 1;
    const stamina = Math.floor(Math.random() * 100) + 1;
    const leadership = Math.floor(Math.random() * 100) + 1;

    // Calculate total
    const total = combat + strategy + speed + defense + strength + accuracy + stamina + leadership;

    // Determine class based on highest stat
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

    // Determine rank based on total
    let rank;
    if (total <= 300) { rank = 'Trainee'; }
    else if (total <= 450) { rank = 'Soldier'; }
    else if (total <= 550) { rank = 'Veteran Soldier'; }
    else if (total <= 650) { rank = 'Elite Soldier'; }
    else if (total <= 750) { rank = 'Squad Leader'; }
    else { rank = 'Commander'; }

    // Create embed
    const embed = {
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

    await message.reply({ embeds: [embed] });
    console.log(`[${new Date().toISOString()}] Stats command used for ${targetUser.username}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in stats command:`, error);
    await message.reply('❌ Error generating stats. Try again!').catch(() => {});
  }
}


// Message Create Event
client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot || !message.guild) return;

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

            // G) HELP COMMAND
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


/**
 * Update bot status with rotating unhinged AoT facts
 */
function updateStatus() {
  const status = aotStatuses[currentStatusIndex];

  client.user.setPresence({
    activities: [{
      name: status,
      type: 4 // Custom status
    }],
    status: 'online'
  });

  console.log(`[${new Date().toISOString()}] 📺 Status updated: ${status}`);

  // Move to next status (cycle back to start at end)
  currentStatusIndex = (currentStatusIndex + 1) % aotStatuses.length;
}

// 7. Bot Ready Event
client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`✅ Using gemini-2.5-flash-lite model`);

  aotrHandler.initialize();

  // Start status rotation
  updateStatus(); // Set initial status
  setInterval(updateStatus, 120000); // Rotate every 2 minutes

  console.log(`✅ Status rotation started (changes every 2 minutes).`);

  setInterval(() => {
    cleanupOldSessions();
  }, CLEANUP_INTERVAL);

  console.log(`✅ Session cleanup scheduled (runs every ${CLEANUP_INTERVAL / 1000 / 60} minutes)`);
  console.log(`✅ Bot is ready! Monitoring channel: ${AI_CHANNEL_ID}`);
});

// 8. Bot Login
client.login(process.env.DISCORD_TOKEN);
