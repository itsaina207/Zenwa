/**
 * Module de gestion de langue simplifié
 * Système complètement indépendant pour éviter les conflits
 */

const fs = require('fs');
const path = require('path');

// Base de données simple pour stocker les préférences de langue
const DB_FILE = path.join(__dirname, '../../data/language_preferences.json');

// Assurer que le répertoire existe
const ensureDirectoryExists = (filePath) => {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
};

// Assurer que le fichier DB existe
const ensureDBExists = () => {
  ensureDirectoryExists(DB_FILE);
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf8');
  }
};

// Obtenir la langue d'un utilisateur
const getUserLanguage = (userId) => {
  ensureDBExists();
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return data[userId] || 'en'; // Par défaut: anglais
  } catch (error) {
    console.error(`Erreur lors de la lecture des préférences de langue: ${error.message}`);
    return 'en'; // En cas d'erreur, utiliser l'anglais
  }
};

// Définir la langue d'un utilisateur
const setUserLanguage = (userId, language) => {
  ensureDBExists();
  try {
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      // Si le fichier existe mais est corrompu, créer un nouvel objet
      data = {};
    }
    
    data[userId] = language;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'écriture des préférences de langue: ${error.message}`);
    return false;
  }
};

// Traductions
const translations = {
  en: {
    languageChanged: '✅ Language changed to English',
    languageOptions: 'Please select a language:\n\nTo choose English: /setlang en\nPour choisir le français: /setlang fr',
    help: `Welcome to the Hedera Wallet Bot! Here are the available commands:

/createwallet - Create a new wallet
/balance - Check your wallet balance
/send - Send HBAR to another account
/sendtoken - Send tokens to another account
/history - View your transaction history
/mint - Create a new token
/setlang - Change the language (EN/FR)
/help - Show this help message

You can also ask me natural language questions like:
- "What's my balance?"
- "Send 5 HBAR to account 0.0.123456"
- "Create a token called MyToken"`
  },
  fr: {
    languageChanged: '✅ Langue changée en Français',
    languageOptions: 'Veuillez choisir une langue :\n\nPour choisir le français : /setlang fr\nTo choose English: /setlang en',
    help: `Bienvenue sur le Bot Hedera Wallet ! Voici les commandes disponibles :

/createwallet - Créer un nouveau wallet
/balance - Vérifier le solde de votre wallet
/send - Envoyer des HBAR à un autre compte
/sendtoken - Envoyer des tokens à un autre compte
/history - Consulter l'historique de vos transactions
/mint - Créer un nouveau token
/setlang - Changer la langue (FR/EN)
/help - Afficher ce message d'aide

Vous pouvez également me poser des questions en langage naturel comme :
- "Quel est mon solde ?"
- "Envoyer 5 HBAR au compte 0.0.123456"
- "Créer un token appelé MonToken"`
  }
};

// Obtenir une traduction
const translate = (userId, key) => {
  const language = getUserLanguage(userId);
  return translations[language]?.[key] || translations.en[key] || key;
};

/**
 * Initialiser le gestionnaire de langue pour le bot
 * @param {TelegramBot} bot Instance du bot Telegram
 */
const initializeLanguageHandler = (bot) => {
  console.log('Initializing simplified language handler with interactive buttons');
  
  // Gestionnaire pour les boutons de langue
  bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id.toString();
    const chatId = msg.chat.id;
    
    console.log(`Callback received: ${action} from user ${userId}`);
    
    if (action === 'lang_en') {
      // Changer la langue en anglais
      const success = setUserLanguage(userId, 'en');
      if (success) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Language set to English' });
        await bot.editMessageText(translations.en.languageChanged, {
          chat_id: chatId,
          message_id: msg.message_id
        });
        setTimeout(() => {
          bot.sendMessage(chatId, translations.en.help);
        }, 500);
      }
    }
    else if (action === 'lang_fr') {
      // Changer la langue en français
      const success = setUserLanguage(userId, 'fr');
      if (success) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Langue définie en français' });
        await bot.editMessageText(translations.fr.languageChanged, {
          chat_id: chatId,
          message_id: msg.message_id
        });
        setTimeout(() => {
          bot.sendMessage(chatId, translations.fr.help);
        }, 500);
      }
    }
  });
  
  // Gestionnaire pour les commandes /language et /setlang
  const languageRegex = /^\/(language|langue|setlang)(?:\s+(.+))?$/;
  bot.onText(languageRegex, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const lang = match[2]?.toLowerCase().trim();
    
    console.log(`Language command received from user ${userId}, lang arg: "${lang}"`);
    
    if (lang === 'en' || lang === 'english' || lang === 'anglais') {
      // Traitement direct sans boutons
      const success = setUserLanguage(userId, 'en');
      if (success) {
        await bot.sendMessage(chatId, translations.en.languageChanged);
        setTimeout(() => {
          bot.sendMessage(chatId, translations.en.help);
        }, 500);
      }
    } 
    else if (lang === 'fr' || lang === 'french' || lang === 'français') {
      // Traitement direct sans boutons
      const success = setUserLanguage(userId, 'fr');
      if (success) {
        await bot.sendMessage(chatId, translations.fr.languageChanged);
        setTimeout(() => {
          bot.sendMessage(chatId, translations.fr.help);
        }, 500);
      }
    }
    else {
      // Afficher les boutons de sélection de langue
      try {
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🇫🇷 Français', callback_data: 'lang_fr' },
                { text: '🇬🇧 English', callback_data: 'lang_en' }
              ]
            ]
          }
        };
        
        await bot.sendMessage(
          chatId,
          'Choisissez votre langue / Choose your language:',
          options
        );
        console.log(`Sent language selection buttons to user ${userId}`);
      } catch (error) {
        console.error(`Error sending language options: ${error.message}`);
        // Fallback en cas d'erreur avec les boutons
        const currentLang = getUserLanguage(userId);
        await bot.sendMessage(chatId, translations[currentLang].languageOptions);
      }
    }
  });
};

module.exports = {
  initializeLanguageHandler,
  getUserLanguage,
  setUserLanguage,
  translate
};