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
- **Dynamic admin control system with live config and slash command category toggling**  

---

## 🤖 Agents & Systems

### 1. **Main Bot Agent** (`index.js`)
**Role:** Central orchestration layer that handles all Discord events and command routing.

**Key Responsibilities:**
- Discord event handling (messageCreate, interactionCreate, ready)
- Command parsing and routing (both message-based and slash commands)
- Hot-reload config and session management
- Slash command (un)registration based on config
- Live status rotation and HTTP API for health checks

**Technologies:**
- Discord.js Client (Gateway Intents: Guilds, GuildMessages, MessageContent, GuildMembers)
- Express HTTP server on port 10000
- Google Generative AI SDK

**Important Dynamic Variables:**
```javascript
const GUILD_ID = '1316791123422740572'; // The Paradis Legion server
global.COOLDOWN_TIME // Configurable via /control set-cooldown
global.SESSION_TIMEOUT // Configurable via /control set-session-timeout
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
```

---

### 2. **AI Conversation Agent** (Gemini Integration)
**Role:** Handles natural language conversations using Google's Gemini AI with persistent context.

**Key Features:**
- **Persistent Chat Sessions:** Each Discord channel has its own chat session stored in `chatSessions` Map
- **Session Memory:** Duration (48hrs by default, now fully configurable live)
- **Personality System:** System instructions change based on active/default per-channel personality (also settable live)
- **Gaslighting Mode:** Optional mode as before

---

### 3. **Personality System Agent**
**Role:** Manages switchable bot personalities per Discord channel. Now includes admin settable defaults per channel via `/control`.

---

### 4. **Command & Control System Agents**

#### **A. Dynamic Slash Command Handler**
- All commands (including core moderation, utility, fun, game, persona, management) defined in a single declarative array.
- Command (un)registration is **dynamically filtered** by category on startup or any change to config (persistent with `disabledCommands`).

#### **B. `/control` Admin Command (NEW, v2.1+)**
- Staff-only; grants full real-time control over bot config and feature toggling
- **12 subcommands**: toggle-bot, set-ai-channel, set-cooldown, set-session-timeout, set-personality-default, disable-commands, rate-limit, auto-mod, view-config, clear-sessions, add-status, remove-status
- Each change reflected in-memory and hot-reloadable `config.json` (see Config Management Agent)
- **Category toggling**: disables/hides commands from Discord instantly and after restart
- **Displayed in `/help management` and `/help all`**

---

### 5. **Config Management Agent**
**Role:** Hot-reloadable configuration system with full field validation and autocreation of defaults. All admin settings now live-editable from Discord.

**Config File Example:**
```json
{
  "botEnabled": true,
  "aiChannelId": "...",
  "statusMessages": ["...", ...],
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
**Any missing field is auto-filled by loadConfig().**

---

### 6. **Ready Event / Command Startup Logic**
- On bot ready, commands are filtered using the `disabledCommands` list (persisted in config).
- Only enabled categories/commands are registered and visible in Discord.
- Filtering logic dynamically handles 'all', 'game', 'fun', 'persona', etc., for complete visibility control.

---

### 7. **Bot Management Help Integration (Help System)**
- `/help management`: Full guide for all `/control` subcommands & admin toggles
- `/help all` now always shows Bot Management section
- If commands/categories are hidden by admin, they do not appear in Discord but their help still remains available to admins.

---

### 8. **Previous Agents Remain as Documented**
- Message-based commands, moderation, fun/games, AoTR handler, etc., are unchanged and fully compatible with control system upgrades.

---

## 🗂️ File Structure
No major changes. **index.js** slightly larger, but real future-proofing is in admin/manage capability.

---

## 🎯 Best Practices for Future Mods
- Use `/control` or update config.json (do not hardcode settings)
- Always run and test on a staging channel before going live
- Update AGENTS.md whenever disabling/renaming commands or adding admin controls

---

## 🔗 References
- Discord.js Docs: https://discord.js.org/
- Gemini Docs: https://ai.google.dev/docs
- AGENTS.md maintained by ShifoSan

---
**Last Updated:** November 25, 2025
**Bot Version:** v2.1
**Maintainer:** ShifoSan
