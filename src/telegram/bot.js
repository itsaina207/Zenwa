/**
 * Telegram bot setup and initialization
 */

const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config');
const { registerCommands } = require('./commands');
const { setupMiddleware } = require('./middleware');

let bot = null;

/**
 * Create and initialize the Telegram bot
 * @returns {TelegramBot} Configured bot instance
 */
function createBot() {
  if (bot) return bot;

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Telegram bot token missing. Check your environment variables.');
  }

  try {
    // Create a bot instance with polling enabled
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

    // Set up middleware for message processing FIRST
    setupMiddleware(bot);
    
    // THEN set up command handlers
    registerCommands(bot);

    console.log('Telegram bot initialized successfully');
    return bot;
  } catch (error) {
    console.error(`Failed to initialize Telegram bot: ${error.message}`);
    throw error;
  }
}

/**
 * Get the bot instance
 * @returns {TelegramBot|null} Bot instance or null if not initialized
 */
function getBot() {
  return bot;
}

module.exports = {
  createBot,
  getBot,
};
