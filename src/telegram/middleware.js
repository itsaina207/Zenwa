/**
 * Middleware for Telegram bot message processing
 */

/**
 * Handle unknown commands
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Message object
 */
function handleUnknownCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  if (text.startsWith('/')) {
    const command = text.split(' ')[0]; // Get the command part
    
    bot.sendMessage(
      chatId,
      `Unknown command: ${command}\nUse /help to see available commands.`
    );
  }
}

/**
 * Log all messages for debugging
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Message object
 */
function logMessages(bot, msg) {
  const username = msg.from.username || msg.from.first_name || 'Unknown';
  const userId = msg.from.id;
  const text = msg.text || '';
  
  console.log(`[${new Date().toISOString()}] Message from @${username} (${userId}): ${text}`);
}

/**
 * Setup all middleware for the bot
 * @param {TelegramBot} bot - Telegram bot instance
 */
function setupMiddleware(bot) {
  // Add middleware for logging all messages
  bot.on('message', msg => {
    logMessages(bot, msg);
  });
  
  // Nous avons temporairement désactivé le gestionnaire de commandes inconnues
  // pour résoudre les problèmes avec /language
  
  // Handle errors
  bot.on('polling_error', error => {
    console.error(`Polling error: ${error.message}`);
  });
}

module.exports = {
  setupMiddleware,
};
