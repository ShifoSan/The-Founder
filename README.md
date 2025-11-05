# The Founder

## Description
The Founder is an AI moderation assistant for The Paradis Legion Discord server. It uses the Google Gemini API to provide intelligent, context-aware auto-replies in a designated channel, and also includes a suite of moderation commands for staff members. The bot is designed for deployment on Render and includes a lightweight Express.js server to maintain uptime.

## Core Features
- **AI Auto-Reply:** Automatically responds to messages in a specific channel using the Gemini API, maintaining conversation context.
- **Moderation Commands:** Includes `purge`, `warn`, and `say` commands for server management.
- **Role-Based Permissions:** Commands like `purge` and `warn` are restricted to staff members.
- **Render Deployment Ready:** Includes an Express.js server to meet the requirements of hosting services like Render.

## Setup Instructions
1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd discord-gemini-bot
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
    -   Under the "Bot" tab, enable the **Message Content Intent**.
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

-   **Purge Messages:**
    -   `@The Founder purge <number>`
    -   *Example:* `@The Founder purge 10 messages`
-   **Warn a User:**
    -   `@The Founder warn <@user> [reason]`
    -   *Example:* `@The Founder warn @User123 for spamming.`
-   **Make the Bot Speak:**
    -   `@The Founder say <message>`
    -   *Example:* `@The Founder say Hello everyone!`

## Render Deployment
This bot is designed to be deployed on a service like Render. The included Express.js server will create a web service that Render can use to keep the bot online. When deploying, use `npm start` as the start command.
