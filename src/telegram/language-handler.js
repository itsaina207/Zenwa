/**
 * Gestionnaire de langue simplifié pour le bot Telegram
 * Ce module permet de changer la langue du bot avec une approche directe
 */

const { LANGUAGES, setUserLanguage, translate } = require('../utils/localizations');

/**
 * Initialise le gestionnaire de langue pour le bot
 * @param {TelegramBot} bot - Instance du bot Telegram
 */
function initializeLanguageHandler(bot) {
  console.log('Initializing separate language handler');
  
  // Version simplifiée - les réponses sont envoyées comme des messages directs
  // Pattern plus large pour capturer toutes les variantes possibles de la commande
  bot.onText(/^\/(language|langue)(?:\s+(.*))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const langArg = match[2] ? match[2].toLowerCase() : '';
    
    console.log(`DIRECT Language handler: User ${userId}, arg: "${langArg}"`);
    
    if (langArg === 'en' || langArg === 'english' || langArg === 'anglais') {
      // Définir la langue en anglais
      const success = setUserLanguage(userId, LANGUAGES.EN);
      if (success) {
        await bot.sendMessage(chatId, '✅ Language changed to English');
        
        // Envoyer un message d'aide dans la nouvelle langue
        setTimeout(async () => {
          const helpMessage = translate(userId, 'help');
          await bot.sendMessage(chatId, helpMessage);
        }, 500);
      }
    } 
    else if (langArg === 'fr' || langArg === 'french' || langArg === 'français') {
      // Définir la langue en français  
      const success = setUserLanguage(userId, LANGUAGES.FR);
      if (success) {
        await bot.sendMessage(chatId, '✅ Langue changée en Français');
        
        // Envoyer un message d'aide dans la nouvelle langue
        setTimeout(async () => {
          const helpMessage = translate(userId, 'help');
          await bot.sendMessage(chatId, helpMessage);
        }, 500);
      }
    }
    else {
      // Afficher les options de langue
      const message = `
Veuillez choisir une langue / Please select a language:

Pour choisir le français: /language fr
To choose English: /language en
      `;
      
      await bot.sendMessage(chatId, message);
    }
  });
}

module.exports = {
  initializeLanguageHandler
};