# AGENTS.md - The Founder Discord Bot

> **Purpose:** This file describes the agents, tools, and architecture of The Founder Discord bot to help Google Jules (or other AI coding assistants) understand the codebase, including all legacy and new admin features.

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
- Dynamic admin control system with live config and slash command category toggling  
- AoTR (Attack on Titan Revolution) game Q&A handler

---

## 🤖 Agents & Systems

### 1. Main Bot Agent (`index.js`)
Handles Discord events, routes message and slash commands, manages hot-reloadable config, AI session storage, and dynamic command registry.

### 2. AI Conversation Agent (Gemini Integration)
- Persistent channel-specific chat sessions
- Memory lifetime is dynamically configurable (default 48 hours)
- Supports per-channel personality system chosen by user or admin
- Optional gaslighting/fun mode for playful features
- Natural language replies and context persistence

### 3. Personality System Agent
- Switchable personalities per channel (AoT themed: Eren, Mikasa, Levi, Ymir, Default, Unhinged)
- Admins can set default per-channel personality via `/control`
- Personality files reside in /personalities

### 4. Command System Agents
#### A. Message-Based Commands
- Mentions and message commands: purge, warn, announce, say, summon, reset, persona, help, survival, titan, stats.
#### B. Slash Command Handler
- Registers all major commands as Discord slash commands
- Dynamic filter built-in: only enabled commands registered based on config (see admin section)
#### C. Category Filtering (NEW)
- Admins can instantly enable/disable command categories (game, fun, persona, all) for all users; unregistered live and on restart.

### 5. Moderation Agent
- Staff role permission checks on moderation commands
- Bulk message deletion (`purge`), warning system with logging to staff channel, announcement embeds
- Staff log channel and custom role IDs loaded from .env/config

### 6. Game Systems Agent
- Entertainment and random generator commands:
  - `/survival [@user]`: AoT combat odds (random, RPG stats)
  - `/titan [@user]`: Random Titan assignment (9 types)
  - `/stats [@user]`: RPG stat generator, class, rank

### 7. Fun Commands Agent
- AI-based roast system (`roast`, disables, blacklist)
- Mandela/fake-history for playful effects
- Gaslighting playful mode toggles
- All fun/game randomness is per-command (no persistent DB)

### 8. AoTR Q&A Handler Agent (`aotr-handler.js`)
- Scrapes Roblox/Fandom wiki
- Caches Q&A for performance
- Answers in special info channel using AI and custom logic

### 9. Config Management Agent
- config.json at repo root (hot-reload, watched)
- config fields dynamically populate with defaults if missing
- All control actions store new values persistently

### 10. HTTP API Agent (Express Server)
- Health check at root
- /api/status, /api/config, /api/toggle, /api/update-config, /api/restart endpoints for external dashboard integration

### 11. NEW: Bot Management Control Agent (Admin System, v2.1+)
Manages all dynamic admin features and powers `/control` command system.
- `/control` (Staff only; 12 subcommands):
    - toggle-bot, set-ai-channel, set-cooldown, set-session-timeout, set-personality-default, disable-commands, rate-limit, auto-mod, view-config, clear-sessions, add-status, remove-status
    - Live effect via config & globals
    - Category toggling (instant hiding/enabling of major command categories)
    - Tracked in config.json `disabledCommands` array
    - All changes instantly reflected in both memory and `config.json` file
- Shown in `/help management` and `/help all`. See Help System section.

---

## 🗂️ File Structure
```
The-Founder/
├── index.js                  # Main orchestration file (2000+ lines, core logic and all handlers)
├── aotr-handler.js           # AoT Revolution Q&A logic
├── config.json               # Hot-reloadable configuration
├── package.json              # Dependencies
├── System Instructions.txt   # Gemini system role prompt
├── .env(.example)            # Environment for secrets/IDs
├── personalities/            # Eren, Mikasa, Levi, etc. personality files
├── README.md, .gitignore    
```

---

## 🔧 Environment Variables
Required:
- `DISCORD_TOKEN`, `GEMINI_API_KEY`, `AI_CHANNEL_ID`, `STAFF_ROLE_ID`, `STAFF_LOG_CHANNEL`, `GUILD_ID`
Optional:
- `PORT`, `AOTR_INFO_CHANNEL_ID`

---

## 📦 Dependencies
Core: discord.js, @google/generative-ai, dotenv, express
For Q&A Handler: axios, cheerio

---

## 🔥 Config.json Layout
Dynamically expanded by config agent! Latest schema:
```json
{
  "botEnabled": true,
  "aiChannelId": "...",
  "statusMessages": ["Status1", ...],
  "cooldownTime": 3,
  "cooldownUnit": "seconds",
  "sessionTimeout": 48,
  "sessionTimeoutUnit": "hours",
  "personalityDefaults": {},
  "disabledCommands": [],
  "rateLimitSettings": { "enabled": true, "maxRequests": 10, "timeWindow": 60 },
  "autoModeration": { "enabled": false, "deleteSpam": false, "warnOnCaps": false }
}
```

---

## 🎯 Design Patterns & Best Practices
1. **Slash Command Registration:**
   - All commands defined at top; command objects use ApplicationCommandOptionType.X (discord.js v14)
   - Only registered if not disabled in `disabledCommands`
2. **State Globals:**
   - `global.COOLDOWN_TIME` and `global.SESSION_TIMEOUT` are always current per config
3. **Safe Error Handling:**
   - All command logic wrapped in try-catch. Staff permission checks are explicit and centralized
4. **Embeds:**
   - Consistent structure, creation via helper functions (see embed patterns in index.js)
5. **Hot Reload:**
   - Config reloads on file change, new settings take effect immediately

---

## 📚 Help System Anatomy
- `/help [category]` includes: moderation, fun, persona, game, ai, bot management, all
- `/help management` gives a detailed guide for each `/control` subcommand
- If commands are disabled/hid, their help still displays to staff/admins
- Overview includes visual summary of what commands each category supports

---

## 📝 Developer Notes & Customization
- Always use `/control` or edit config.json for new settings—never hardcode
- When adding new commands: add to slashCommands array, build a handler, update help system, document here
- AGENTS.md should be updated whenever features/handlers/config fields are added or changed
- Customize personalities by adding txt files to personalities dir & registering the name
- To refactor (for future modularization): extract utils (embeds, configs, session) and move handlers to their own modules for file-size and maintainability

---

## 🔍 Troubleshooting & Common Issues
### Slash commands missing
1. Wait up to 5min for commands to appear (Discord cache)
2. Check `disabledCommands` (they might be intentionally hidden)
3. Verify bot permissions and GUILD_ID
### AI/Moderation Features not working
1. Check that all .env vars are set
2. Confirm config.json schema (field spelling, etc)
3. Restart bot and check logs
4. Use `/control view-config` to debug live settings

---

## 📝 Change Log
- **v2.1 (Nov 25, 2025):** Added full dynamic `/control` admin system, live config, command category toggling, and config dashboard. All major previous agent features (moderation, game, fun, personality, Q&A, hot reload) maintained and fully compatible.

**Maintainer:** ShifoSan
