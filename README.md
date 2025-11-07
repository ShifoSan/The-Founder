# The Founder

## Description
The Founder is a multi-purpose AI assistant for The Paradis Legion Discord server. It is powered by the Google Gemini API and features an advanced personality-switching system, AI-driven conversations, robust moderation tools, and dynamic status updates. The bot is designed for reliable deployment on Render.

## Core Features
- **AI Auto-Reply:** Automatically responds to messages in a specific channel using the Gemini API, maintaining stateful conversation context.
- **Personality System:** Allows users to switch the bot's personality on a per-channel basis between several Attack on Titan characters.
- **Moderation Commands:** Includes `purge`, `warn`, `say`, and `summon` commands for server management.
- **Comprehensive Help System:** A clean, embed-based `help` command that details all features.
- **Rotating Status:** The bot's status message automatically rotates every 2 minutes with unhinged Attack on Titan facts.
- **Role-Based Permissions:** Critical commands are restricted to staff members.
- **Render Deployment Ready:** Includes a lightweight Express.js server to ensure uptime on hosting platforms.

## Setup Instructions
1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd the-founder-bot
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create a `.env` file:**
    -   Copy the `.env.example` file to a new file named `.env`.
    -   Fill in the required values for the environment variables.
4.  **Enable Discord Bot Intents:**
    -   Go to the Discord Developer Portal for your bot.
    -   Under the "Bot" tab, enable the **Message Content Intent** and **Server Members Intent**.
5.  **Start the bot:**
    ```bash
    npm start
    ```

## Environment Variables
-   `DISCORD_TOKEN`: Your Discord bot's token.
-   `GEMINI_API_KEY`: Your Google Gemini API key.
-   `PORT`: The port for the Express server to listen on (defaults to 10000).
-   `AI_CHANNEL_ID`: The ID of the channel where the bot will auto-reply.
-   `STAFF_ROLE_ID`: The ID of the staff role required for moderation commands.
-   `STAFF_LOG_CHANNEL`: The ID of the channel where moderation actions are logged.

## Command Usage
*All commands must be prefixed by mentioning the bot (e.g., `@The Founder`).*

### Help Command
The main help command provides a comprehensive overview of all bot features.
-   `@The Founder help` - Shows the main overview.
-   `@The Founder help moderation` - Details the moderation commands.
-   `@The Founder help persona` - Explains the personality system.
-   `@The Founder help ai` - Describes the AI features.
-   `@The Founder help all` - Shows all help pages at once.

### Moderation Commands (Staff Only)
-   **Purge Messages:**
    -   `@The Founder purge <number>`
    -   *Example:* `@The Founder purge 20`
-   **Warn a User:**
    -   `@The Founder warn <@user> [reason]`
    -   *Example:* `@The Founder warn @User123 for spamming.`
-   **Reset AI Conversation:**
    -   `@The Founder reset`
    -   *Example:* `@The Founder reset` (clears the AI's memory for the current channel).

### General Commands (Anyone)
-   **Make the Bot Speak:**
    -   `@The Founder say <message>`
    -   *Example:* `@The Founder say Welcome to the server!`
-   **Summon a User:**
    -   `@The Founder summon <@user>`
    -   *Example:* `@The Founder summon @User123`

### Personality System
-   **Switch Personality:**
    -   `@The Founder persona <name>`
    -   *Example:* `@The Founder persona eren`
-   **List Personalities:**
    -   `@The Founder persona list`
-   **Check Current Personality:**
    -   `@The Founder persona`
-   **Reset to Default:**
    -   `@The Founder persona reset`

## Render Deployment
This bot is designed to be deployed on a service like Render. The included Express.js server will create a web service that Render can use to keep the bot online. When deploying, use `npm start` as the start command.
