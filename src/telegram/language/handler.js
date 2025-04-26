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
    helpText: `Welcome to the Hedera Wallet Bot! Here are the available commands:

You can use these buttons below or type commands manually:

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
- "Create a token called MyToken"`,
    help: "Welcome to the Hedera Wallet Bot! Select an option below:",
    createWalletInfo: "Creating a new wallet...",
    balanceInfo: "Checking your balance...",
    sendInfo: "Send HBAR to another account",
    sendTokenInfo: "Send tokens to another account",
    historyInfo: "View your transaction history",
    mintInfo: "Create a new token",
    walletLabel: "💼 Create Wallet",
    balanceLabel: "💰 Check Balance",
    sendLabel: "📤 Send HBAR",
    sendTokenLabel: "🔄 Send Tokens",
    historyLabel: "📜 History",
    mintLabel: "✨ Create Token",
    languageLabel: "🌐 Language",
    helpLabel: "❓ Help",
    fullHelpLabel: "📚 Full Help"
  },
  fr: {
    languageChanged: '✅ Langue changée en Français',
    languageOptions: 'Veuillez choisir une langue :\n\nPour choisir le français : /setlang fr\nTo choose English: /setlang en',
    helpText: `Bienvenue sur le Bot Hedera Wallet ! Voici les commandes disponibles :

Vous pouvez utiliser les boutons ci-dessous ou taper les commandes manuellement :

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
- "Créer un token appelé MonToken"`,
    help: "Bienvenue sur le Bot Hedera Wallet ! Sélectionnez une option ci-dessous :",
    createWalletInfo: "Création d'un nouveau wallet...",
    balanceInfo: "Vérification de votre solde...",
    sendInfo: "Envoyer des HBAR à un autre compte",
    sendTokenInfo: "Envoyer des tokens à un autre compte",
    historyInfo: "Consulter l'historique de vos transactions",
    mintInfo: "Créer un nouveau token",
    walletLabel: "💼 Créer Wallet",
    balanceLabel: "💰 Vérifier Solde",
    sendLabel: "📤 Envoyer HBAR",
    sendTokenLabel: "🔄 Envoyer Tokens",
    historyLabel: "📜 Historique",
    mintLabel: "✨ Créer Token",
    languageLabel: "🌐 Langue",
    helpLabel: "❓ Aide",
    fullHelpLabel: "📚 Aide complète"
  }
};

/**
 * Fonction pour envoyer un menu d'aide avec boutons interactifs
 * @param {TelegramBot} bot - Instance du bot Telegram 
 * @param {string} userId - ID de l'utilisateur
 * @param {number} chatId - ID du chat
 */
const sendHelpWithButtons = async (bot, userId, chatId) => {
  try {
    const lang = getUserLanguage(userId);
    
    // Créer les boutons interactifs en fonction de la langue
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: translate(userId, 'walletLabel'), callback_data: 'cmd_wallet' },
            { text: translate(userId, 'balanceLabel'), callback_data: 'cmd_balance' }
          ],
          [
            { text: translate(userId, 'sendLabel'), callback_data: 'cmd_send' },
            { text: translate(userId, 'sendTokenLabel'), callback_data: 'cmd_sendtoken' }
          ],
          [
            { text: translate(userId, 'historyLabel'), callback_data: 'cmd_history' },
            { text: translate(userId, 'mintLabel'), callback_data: 'cmd_mint' }
          ],
          [
            { text: translate(userId, 'languageLabel'), callback_data: 'cmd_language' },
            { text: translate(userId, 'fullHelpLabel'), callback_data: 'cmd_fullhelp' }
          ]
        ]
      }
    };
    
    // Envoyer le message avec les boutons
    await bot.sendMessage(chatId, translate(userId, 'help'), options);
    console.log(`Sent help menu with buttons to user ${userId}`);
  } catch (error) {
    console.error(`Error sending help menu: ${error.message}`);
    // Fallback en cas d'erreur
    await bot.sendMessage(chatId, translate(userId, 'helpText'));
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
  
  // Gestionnaire pour tous les boutons interactifs
  bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id.toString();
    const chatId = msg.chat.id;
    
    console.log(`Callback received: ${action} from user ${userId}`);
    
    // GESTION DES BOUTONS DE LANGUE
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
          sendHelpWithButtons(bot, userId, chatId);
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
          sendHelpWithButtons(bot, userId, chatId);
        }, 500);
      }
    }
    // GESTION DES BOUTONS DE COMMANDES
    else if (action === 'cmd_help') {
      await bot.answerCallbackQuery(callbackQuery.id);
      await sendHelpWithButtons(bot, userId, chatId);
    }
    else if (action === 'cmd_fullhelp') {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, translate(userId, 'helpText'));
    }
    else if (action === 'cmd_wallet') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'createWalletInfo') });
      // Simuler la commande /createwallet
      bot.emit('message', { ...msg, text: '/createwallet', from: msg.from, chat: msg.chat });
    }
    else if (action === 'cmd_balance') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'balanceInfo') });
      // Simuler la commande /balance
      bot.emit('message', { ...msg, text: '/balance', from: msg.from, chat: msg.chat });
    }
    else if (action === 'cmd_send') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'sendInfo') });
      // Simuler la commande /send
      bot.emit('message', { ...msg, text: '/send', from: msg.from, chat: msg.chat });
    }
    else if (action === 'cmd_sendtoken') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'sendTokenInfo') });
      // Simuler la commande /sendtoken
      bot.emit('message', { ...msg, text: '/sendtoken', from: msg.from, chat: msg.chat });
    }
    else if (action === 'cmd_history') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'historyInfo') });
      // Simuler la commande /history
      bot.emit('message', { ...msg, text: '/history', from: msg.from, chat: msg.chat });
    }
    else if (action === 'cmd_mint') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'mintInfo') });
      // Simuler la commande /mint
      bot.emit('message', { ...msg, text: '/mint', from: msg.from, chat: msg.chat });
    }
    else if (action === 'cmd_language') {
      await bot.answerCallbackQuery(callbackQuery.id);
      // Afficher les options de langue
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
          sendHelpWithButtons(bot, userId, chatId);
        }, 500);
      }
    } 
    else if (lang === 'fr' || lang === 'french' || lang === 'français') {
      // Traitement direct sans boutons
      const success = setUserLanguage(userId, 'fr');
      if (success) {
        await bot.sendMessage(chatId, translations.fr.languageChanged);
        setTimeout(() => {
          sendHelpWithButtons(bot, userId, chatId);
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