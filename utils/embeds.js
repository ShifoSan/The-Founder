function createOverviewEmbed(client) {
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

function createAIEmbed(botConfig) {
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

function createPersonaListEmbed(descriptions, personalityEmojis) {
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

module.exports = {
  createOverviewEmbed,
  createModerationEmbed,
  createPersonaEmbed,
  createAIEmbed,
  createGameEmbed,
  createFunEmbed,
  createBotManagementEmbed,
  createStatusEmbed,
  createPersonaListEmbed,
  generateSurvivalEmbed,
  generateTitanEmbed,
  generateStatsEmbed
};
