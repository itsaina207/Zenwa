/**
 * Telegram bot setup and initialization
 */

const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config');
const { registerCommands } = require('./commands');
const { setupMiddleware } = require('./middleware');
// Utiliser le nouveau gestionnaire de langue plus simple
const { initializeLanguageHandler } = require('./language/handler');

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
    // Create a bot instance with polling enabled with error handling
    const botOptions = { 
      polling: true,
      request: {
        // Configure request timeout to avoid hanging
        connect_timeout: 10000,
        read_timeout: 10000
      }
    };
    
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, botOptions);
    
    // Add error handler for polling
    bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error.message);
      // Don't crash on polling errors
    });
    
    // Add error handler for webhook
    bot.on('webhook_error', (error) => {
      console.error('Telegram webhook error:', error.message);
      // Don't crash on webhook errors
    });
    
    // Add error handler for API calls
    bot.on('error', (error) => {
      console.error('Telegram API error:', error.message);
      // Don't crash on API errors
    });

    // Set up middleware for message processing FIRST
    try {
      setupMiddleware(bot);
      console.log('Telegram middleware initialized');
    } catch (error) {
      console.error('Error setting up middleware:', error.message);
      // Continue despite middleware setup errors
    }
    
    // Initialize the dedicated language handler
    try {
      initializeLanguageHandler(bot);
      console.log('Language handler initialized');
    } catch (error) {
      console.error('Error initializing language handler:', error.message);
      // Continue despite language handler initialization errors
    }
    
    // THEN set up command handlers
    try {
      registerCommands(bot);
      console.log('Commands registered successfully');
    } catch (error) {
      console.error('Error registering commands:', error.message);
      // Continue despite command registration errors
    }

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
