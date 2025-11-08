const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const WIKI_BASE_URL = 'https://official-attack-on-titans-revolution.fandom.com';
const ALL_PAGES_URL = `${WIKI_BASE_URL}/wiki/Special:AllPages`;

let wikiIndex = new Map();
let lastScrapeTime = 0;
const pageContentCache = new Map();
let genAI;

const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Scrapes the Special:AllPages page to build an index of all wiki pages.
 */
async function buildWikiIndex() {
  const now = Date.now();
  if (now - lastScrapeTime < TWENTY_FOUR_HOURS_IN_MS && wikiIndex.size > 0) {
    console.log('[AOTR_HANDLER] Wiki index is up-to-date. Skipping scrape.');
    return;
  }

  console.log('[AOTR_HANDLER] Scraping wiki index from Special:AllPages...');
  try {
    const { data } = await axios.get(ALL_PAGES_URL);
    const $ = cheerio.load(data);
    const newIndex = new Map();

    $('.mw-allpages-chunk li a').each((i, element) => {
      const title = $(element).attr('title');
      const url = `${WIKI_BASE_URL}${$(element).attr('href')}`;
      if (title && url) {
        newIndex.set(title.toLowerCase(), { title, url });
      }
    });

    if (newIndex.size > 0) {
      wikiIndex = newIndex;
      lastScrapeTime = now;
      console.log(`[AOTR_HANDLER] Successfully built wiki index with ${wikiIndex.size} pages.`);
    }
  } catch (error) {
    console.error('[AOTR_HANDLER] Error scraping wiki index:', error);
  }
}

/**
 * Finds the top N most relevant wiki pages based on keywords in the user's message.
 */
function findRelevantPages(messageContent, topN = 3) {
  const queryTokens = messageContent.toLowerCase().split(/\s+/);
  const scores = new Map();

  for (const [key, { title }] of wikiIndex.entries()) {
    let score = 0;
    const pageTitleTokens = title.toLowerCase().split(/\s+/);

    queryTokens.forEach(token => {
      if (key.includes(token)) score += 2;
      if (pageTitleTokens.some(pt => pt.includes(token))) score++;
    });

    if (score > 0) {
      scores.set(key, score);
    }
  }

  const sortedPages = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return sortedPages.slice(0, topN).map(([key]) => wikiIndex.get(key));
}

/**
 * Scrapes and cleans the content of a single wiki page.
 */
async function scrapePageContent(url) {
  const now = Date.now();
  if (pageContentCache.has(url)) {
    const { content, timestamp } = pageContentCache.get(url);
    if (now - timestamp < TWENTY_FOUR_HOURS_IN_MS) {
      console.log(`[AOTR_HANDLER] Using cached content for ${url}`);
      return content;
    }
  }

  console.log(`[AOTR_HANDLER] Scraping content from ${url}`);
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    $('.mw-parser-output .toc, .mw-parser-output .wikia-gallery, .mw-parser-output .navbox').remove();

    let content = $('.mw-parser-output').text().trim();
    content = content.replace(/\s\s+/g, ' ');

    if (content.length > 6000) {
        content = content.substring(0, 6000) + '...';
    }

    pageContentCache.set(url, { content, timestamp: now });
    return content;
  } catch (error) {
    console.error(`[AOTR_HANDLER] Error scraping page content from ${url}:`, error);
    return null;
  }
}

/**
 * Initializes the AoTR handler.
 */
async function initialize() {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  await buildWikiIndex();
  setInterval(buildWikiIndex, TWENTY_FOUR_HOURS_IN_MS);
}

/**
 * Handles messages in the AoTR info channel.
 */
async function handleMessage(message) {
  await message.channel.sendTyping();

  const relevantPages = findRelevantPages(message.content);
  if (relevantPages.length === 0) {
    // No need to reply if no relevant pages are found.
    return;
  }

  let combinedContent = '';
  for (const page of relevantPages) {
    const content = await scrapePageContent(page.url);
    if (content) {
      combinedContent += `--- START OF ${page.title.toUpperCase()} ---\n\n${content}\n\n--- END OF ${page.title.toUpperCase()} ---\n\n`;
    }
  }

  if (!combinedContent) {
    return;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const prompt = `You are a helpful Attack on Titan Revolution (AoTR) game wiki bot. Answer the user's question based *only* on the provided wiki content. Be concise and helpful. The user's question is: "${message.content}"\n\nWiki Content:\n${combinedContent}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    if (text.length > 1200) {
        text = text.substring(0, 1200) + '...';
    }

    await message.reply(text);
  } catch (error) {
    console.error('[AOTR_HANDLER] Error generating content from Gemini:', error);
    await message.reply("I had trouble summarizing the information. Please try asking in a different way.");
  }
}

module.exports = {
  initialize,
  handleMessage,
};
