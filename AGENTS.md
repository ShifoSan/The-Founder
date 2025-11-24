# AGENTS.md - The Founder Discord Bot

> **Purpose:** This file describes the agents, tools, and architecture of The Founder Discord bot to help Google Jules (or other AI coding assistants) understand the codebase and work with it more effectively.

---

## 📋 Project Overview

**Bot Name:** The Founder  
**Platform:** Discord (discord.js v14)  
**AI Model:** Google Gemini 2.5 Flash Lite  
**Deployment:** Render (Free Tier)  
**Primary Language:** JavaScript (Node.js)  
**Theme:** Attack on Titan themed moderation & personality bot  

### Core Purpose
A multi-functional Discord bot for "The Paradis Legion" server featuring:
- AI-powered conversational responses with persistent memory
- Moderation commands (purge, warn, announce)
- Personality switching system (Attack on Titan characters)
- Game/entertainment commands (survival odds, titan assignment, stats)
- Fun commands (roasting, gaslighting modes)
- Custom status rotation
- AoTR (Attack on Titan Revolution) game Q&A handler

---

## 🤖 Agents & Systems

### 1. **Main Bot Agent** (`index.js`)
**Role:** Central orchestration layer that handles all Discord events and command routing.

**Key Responsibilities:**
- Discord event handling (messageCreate, interactionCreate, ready)
- Command parsing and routing (both message-based and slash commands)
- Session management for AI conversations
- Status rotation (every 2 minutes)
- HTTP server for health checks and dashboard API

**Technologies:**
- Discord.js Client (Gateway Intents: Guilds, GuildMessages, MessageContent, GuildMembers)
- Express HTTP server on port 10000
- Google Generative AI SDK

**Important Variables:**
```javascript
const GUILD_ID = '1316791123422740572'; // The Paradis Legion server
const SESSION_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const COOLDOWN_TIME = 3000; // 3 seconds
```

---

### 2. **AI Conversation Agent** (Gemini Integration)
**Role:** Handles natural language conversations using Google's Gemini AI with persistent context.

**Key Features:**
- **Persistent Chat Sessions:** Each Discord channel has its own chat session stored in `chatSessions` Map
- **48-Hour Memory:** Conversations persist for 48 hours of inactivity
- **Personality System:** System instructions change based on active personality
- **Gaslighting Mode:** Optional mode that adds fictional/absurd elements to responses

**Session Management:**
```javascript
function getChatSession(channelId) {
  // Returns existing session or creates new one
  // Loads personality-specific system instructions
  // Applies gaslighting mode if active
}

function clearChatSession(channelId) {
  // Resets conversation history for a channel
}
```

**Configuration:**
```javascript
generationConfig: {
  maxOutputTokens: 1024,
  temperature: 0.9
}
```

---

### 3. **Personality System Agent**
**Role:** Manages switchable bot personalities per Discord channel.

**Available Personalities:**
- `default` - The Founder (standard moderation bot)
- `eren` - Eren Yeager (determined, cold, freedom-obsessed)
- `mikasa` - Mikasa Ackerman (stoic, protective, loyal)
- `levi` - Levi Ackerman (blunt, clean freak, skilled)
- `ymir` - Ymir Fritz (tragic, gentle, seeking freedom)
- `unhinged` - Chaotic, random, existential humor

**Data Structure:**
```javascript
// Storage
const personalities = new Map(); // name -> system instruction text
const currentPersonalities = new Map(); // channelId -> personalityName

// Metadata
const personalityEmojis = { 'default': '🤖', 'eren': '⚔️', ... };
const descriptions = { 'default': 'The Founder...', ... };
```

**Personality Files Location:** `/personalities/` directory (e.g., `eren.txt`, `mikasa.txt`)

**Switching Logic:**
- Changing personality clears chat session (resets memory)
- System instructions reload from personality file
- Per-channel setting (different channels can use different personalities)

---

### 4. **Command System Agents**

#### A. **Message-Based Command Handler**
Handles commands via bot mentions (e.g., `@The Founder help`)

**Supported Commands:**
```javascript
// Moderation (Staff only)
purge <number>          // Delete 1-100 messages
warn @user <reason>     // Issue warning with staff log
announce <args>         // Send professional embed announcement

// Utility
say <message>           // Echo text as bot
summon @user            // Dramatic medieval-style summon
reset                   // Clear conversation history (Staff only)

// Personality
persona [name]          // Switch/view personality
persona list            // List all personalities
persona reset           // Reset to default

// Help
help [category]         // Show help (overview, moderation, persona, ai, game, fun, all)

// Game Commands
survival [@user]        // Calculate AoT survival odds
titan [@user]          // Assign random Titan Shifter
stats [@user]          // Show AoT RPG stats
```

#### B. **Slash Command Handler** 
Handles `/` commands registered with Discord API

**All Message Commands + Additional:**
```javascript
/roast @user [intensity]     // AI-generated roast (mild/medium/spicy/hardcore)
/roast-disable               // Toggle roast mode server-wide
/roast-blacklist            // User opts out of roasts
/mandela [fake_event]       // Create absurd fake server event
/fake-history @user         // Fabricate lighthearted fake user history
/gaslight-reset             // Reset gaslighting mode
```

**Registration:** Slash commands are registered to `GUILD_ID` on bot ready event.

---

### 5. **AoTR Q&A Handler Agent** (`aotr-handler.js`)
**Role:** Specialized agent for answering questions about "Attack on Titan Revolution" Roblox game.

**Functionality:**
- Monitors dedicated channel (`AOTR_INFO_CHANNEL_ID`)
- Scrapes game documentation from Fandom wiki
- Uses Gemini AI to answer questions with game-specific context
- Caches scraped content to reduce API calls

**Key Methods:**
```javascript
aotrHandler.initialize()           // Called on bot ready
aotrHandler.handleMessage(message) // Processes messages in AoTR channel
```

**Dependencies:** `axios`, `cheerio` (for web scraping)

---

### 6. **Moderation Agent**
**Role:** Handles server moderation features with staff permission checks.

**Staff-Only Features:**
- Message bulk deletion (purge)
- Warning system with automatic staff logging
- Professional announcement embeds

**Staff Role ID:** Configured via `STAFF_ROLE_ID` environment variable  
**Staff Log Channel:** All moderation actions logged to `STAFF_LOG_CHANNEL`

**Permission Check Pattern:**
```javascript
const isStaff = message.member.roles.cache.has(process.env.STAFF_ROLE_ID);
if (!isStaff) return message.reply('❌ Staff role required');
```

---

### 7. **Game Systems Agent**
**Role:** Provides entertainment via Attack on Titan themed random generators.

**Features:**

**A. Survival Calculator:**
- Generates 6 random stats (Combat, Strategy, Speed, Defense, Strength, Luck)
- Calculates overall survival % (average of stats)
- Returns verdict based on score

**B. Titan Assigner:**
- Randomly assigns one of 9 Titan Shifters
- Each Titan has: name, emoji, height, ability, weakness, power level (1-100)

**C. RPG Stats Generator:**
- Generates 8 stats (Combat, Strategy, Speed, Defense, Strength, Accuracy, Stamina, Leadership)
- Assigns class based on highest stat(s)
- Calculates rank based on total score
- All stats are persistent per-command (not saved to database)

---

### 8. **Fun Commands Agent**
**Role:** Entertainment features with AI-generated content.

**Features:**

**Roast System:**
```javascript
// State variables
let roastDisabled = false;           // Global toggle
let roastBlacklist = [];             // User IDs opted out
```

**Intensity Levels:**
- `mild` - Yellow embed, gentle humor
- `medium` - Orange embed, moderate roasting
- `spicy` - Orange-red embed, spicier humor
- `hardcore` - Dark red embed, maximum allowed intensity (still PG-rated)

**Gaslighting Mode:**
```javascript
let gaslightingActive = false;        // Global toggle

// When active:
// - Adds gaslighting context to AI system instructions
// - Mandela Effect: Creates fake server events
// - Fake History: Fabricates user histories
// - Reset command clears all sessions and disables mode
```

---

### 9. **Config Management Agent**
**Role:** Hot-reloadable configuration system.

**Config File:** `config.json`  
**Storage Location:** Root directory

**Hot Reload:**
```javascript
fs.watch('./config.json', (eventType) => {
  if (eventType === 'change') {
    botConfig = loadConfig();
  }
});
```

**Configurable Settings:**
- `botEnabled` - Master on/off switch
- `aiChannelId` - Auto-reply channel ID
- `statusMessages` - Array of rotating status texts

---

### 10. **HTTP API Agent** (Express Server)
**Role:** Provides REST API for bot management and health monitoring.

**Endpoints:**

```javascript
GET  /                      // Health check (returns "Bot is running")
GET  /health                // Detailed health check with uptime
GET  /api/status            // Bot online status & enabled state
POST /api/toggle            // Toggle bot on/off via config
GET  /api/config            // Get current config
POST /api/update-config     // Update config (aiChannelId, statusMessages)
POST /api/restart           // Restart bot (Render auto-restarts)
```

**Port:** 10000 (or `process.env.PORT`)

---

## 🗂️ File Structure

```
The-Founder/
├── index.js                  # Main bot file (1,900+ lines)
├── aotr-handler.js          # AoTR game Q&A handler
├── config.json              # Hot-reloadable configuration
├── package.json             # Dependencies
├── System Instructions.txt  # Default personality system prompt
├── .env.example             # Environment variable template
├── .gitignore              
├── README.md               
└── personalities/           # Character personality files
    ├── eren.txt
    ├── mikasa.txt
    ├── levi.txt
    ├── ymir.txt
    └── unhinged.txt
```

---

## 🔧 Environment Variables

**Required:**
```bash
DISCORD_TOKEN              # Discord bot token
GEMINI_API_KEY            # Google Gemini API key
AI_CHANNEL_ID             # Channel for auto-replies
STAFF_ROLE_ID             # Staff role ID for permission checks
STAFF_LOG_CHANNEL         # Channel for moderation logs
GUILD_ID                  # Hardcoded in code: 1316791123422740572
```

**Optional:**
```bash
PORT                      # HTTP server port (default: 10000)
AOTR_INFO_CHANNEL_ID     # AoTR Q&A channel
```

---

## 📦 Dependencies

**Core:**
- `discord.js: ^14.16.3` - Discord bot framework
- `@google/generative-ai: ^0.21.0` - Gemini AI SDK
- `dotenv: ^16.4.5` - Environment variable management
- `express: ^4.21.1` - HTTP server

**AoTR Handler:**
- `axios: ^1.7.2` - HTTP requests for wiki scraping
- `cheerio: ^1.0.0-rc.12` - HTML parsing

---

## 🎯 Key Design Patterns

### 1. **Per-Channel State Management**
```javascript
const chatSessions = new Map();      // channelId -> { session, lastActivity }
const currentPersonalities = new Map(); // channelId -> personalityName
```

### 2. **Cooldown System**
```javascript
const cooldowns = new Map();         // userId -> timestamp
// 3-second cooldown for non-staff in AI channel
```

### 3. **Staff Permission Pattern**
```javascript
const isStaff = member.roles.cache.has(process.env.STAFF_ROLE_ID);
if (!isStaff) return reply('❌ Staff only');
```

### 4. **Embed Generation Pattern**
All embeds follow consistent structure:
```javascript
{
  title: string,
  description: string,
  color: 0xHEXCODE,
  fields: [{ name, value, inline }],
  footer: { text },
  timestamp: new Date()
}
```

### 5. **Error Handling**
```javascript
try {
  // Command logic
} catch (error) {
  console.error(`[${new Date().toISOString()}] Error:`, error);
  await interaction.reply('❌ An error occurred...');
}
```

---

## 🚀 Bot Lifecycle

### Startup Sequence:
1. Load environment variables (`.env`)
2. Read system instructions from `System Instructions.txt`
3. Initialize Express HTTP server
4. Load all personality files from `/personalities/`
5. Initialize Discord client with intents
6. Initialize Gemini AI model
7. Login to Discord
8. On `ready` event:
   - Initialize `aotrHandler`
   - Register slash commands to guild
   - Start status rotation (2-minute interval)
   - Start session cleanup (1-hour interval)

### Runtime Flow:
1. **Message Received** → Check if bot enabled → Check channel/mentions
2. **Command Detection** → Parse command → Check permissions → Execute handler
3. **AI Auto-Reply** → Check cooldown → Get/create session → Send to Gemini → Reply
4. **Slash Command** → Route to handler → Defer if needed → Execute → Reply

---

## 💡 Developer Notes for AI Assistants

### When Modifying This Bot:

**1. Command Addition Checklist:**
- [ ] Add to `slashCommands` array (if slash command)
- [ ] Create handler function (e.g., `handleSlash[Name]`)
- [ ] Add case to `interactionCreate` switch
- [ ] Add to appropriate help embed
- [ ] Test both slash and message versions (if applicable)

**2. Personality System:**
- Personality files must be plain `.txt` files in `/personalities/`
- System instruction must be wrapped in `{ parts: [{ text: instruction }] }`
- Changing personality always clears chat session

**3. AI Response Modification:**
- Edit `handleAIResponse()` for global changes
- Use `getChatSession(channelId)` to maintain context
- Check `gaslightingActive` state before adding context

**4. Permission System:**
- Always check `STAFF_ROLE_ID` for moderation commands
- Log moderation actions to `STAFF_LOG_CHANNEL`
- Use `.ephemeral: true` for permission denial messages

**5. Error Handling:**
- Always wrap Gemini API calls in try-catch
- Handle SAFETY and RATE_LIMIT errors explicitly
- Log with ISO timestamp format

**6. Config Changes:**
- Modify `config.json` for runtime settings
- Use `botConfig` variable (hot-reloaded)
- Save with `saveConfig(botConfig)`

---

## 🔍 Common Issues & Solutions

### Issue: Bot not responding to commands
**Check:**
1. Is `botConfig.botEnabled` true?
2. Is message in correct channel? (AI channel for auto-reply)
3. Is bot mentioned? (for message-based commands)
4. Are intents enabled? (MessageContent intent required)

### Issue: AI responses are generic
**Check:**
1. Is correct personality loaded for channel?
2. Check `System Instructions.txt` content
3. Verify personality file exists in `/personalities/`
4. Check if session was recently cleared

### Issue: Slash commands not appearing
**Check:**
1. Is `GUILD_ID` correct?
2. Are commands registered in `ready` event?
3. Check bot has `applications.commands` permission
4. Wait 5 minutes after registration (Discord cache)

---

## 📞 Integration Points

### For Dashboard/Web Interface:
```javascript
// API endpoints available at http://[HOST]:10000
GET  /api/status    // Check bot status
POST /api/toggle    // Enable/disable bot
GET  /api/config    // Get current settings
```

### For External AI Agents:
```javascript
// Use these functions for AI operations
getChatSession(channelId)           // Get/create Gemini session
clearChatSession(channelId)         // Reset conversation
loadPersonalities()                 // Reload personality files
```

---

## 🎨 Customization Guidelines

### Adding New Personality:
1. Create new file: `/personalities/{name}.txt`
2. Write character-specific system instructions
3. Add to `personalityEmojis` and `descriptions` objects
4. Restart bot to load new personality

### Adding New Status Message:
1. Edit `config.json`
2. Add to `statusMessages` array
3. Changes apply automatically (hot-reload)

### Adding New Game Command:
1. Create embed generator function: `generate[Name]Embed(targetUser)`
2. Create command handler: `handleSlash[Name](interaction)`
3. Add to slash command array
4. Add case to `interactionCreate`

---

## 📚 Additional Resources

**Discord.js Documentation:** https://discord.js.org/  
**Gemini AI Documentation:** https://ai.google.dev/docs  
**Attack on Titan Lore:** For personality accuracy  
**Server:** The Paradis Legion (ID: 1316791123422740572)

---

**Last Updated:** November 24, 2025  
**Bot Version:** v2.0  
**Maintainer:** ShifoSan  

---

> **Note:** This file should be updated whenever major architectural changes are made to the bot. Keep it in sync with actual code functionality.
