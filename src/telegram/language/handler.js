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
    helpText: `Welcome to the Zenwa bot! Here are the available commands:

You can use these buttons below or type commands manually:

/createwallet - Create a new wallet
/balance - Check your wallet balance
/send - Send HBAR to another account
/sendtoken - Send tokens to another account
/history - View your transaction history
/mint - Create a new token
/airdrop - Create a token airdrop
/campaign - Create a token campaign
/claim - Claim tokens from a campaign
/claimairdrop - Claim tokens from an airdrop
/mycampaigns - View your campaigns
/setlang - Change the language (EN/FR)
/help - Show this help message

You can also ask me natural language questions like:
- "What's my balance?"
- "Send 5 HBAR to account 0.0.123456"
- "Create a token called MyToken"
- "Claim my airdrop" or "Show my pending airdrops"`,
    help: "Welcome to the Zenwa bot! Select an option below:",
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
    fullHelpLabel: "📚 Full Help",
    
    // Airdrop translations
    airdropIntro: "Welcome to the token airdrop creation wizard! I'll guide you through creating an airdrop of tokens to multiple recipients.",
    airdropTokenIdPrompt: "Please enter the Token ID you want to distribute (format: 0.0.xxx):",
    airdropRecipientsPrompt: "Please enter the account IDs of the recipients, separated by commas (e.g., 0.0.12345,0.0.67890):",
    airdropInvalidRecipients: "❌ Invalid recipient list. Please enter at least one valid account ID.",
    airdropAmountPrompt: "How many tokens do you want to send to each recipient?",
    airdropInvalidAmount: "❌ Invalid amount. Please enter a positive number.",
    airdropConfirmationHeader: "📤 *Token Airdrop Summary*",
    airdropConfirmationPrompt: "Do you want to proceed with this airdrop?",
    airdropProcessing: "⏳ Processing your airdrop request... This may take a moment.",
    airdropCancelled: "❌ Airdrop cancelled.",
    
    // Campaign translations
    campaignIntro: "Welcome to the token campaign creation wizard! A campaign allows users to claim tokens from a pool you create.",
    campaignNamePrompt: "Please enter a name for your campaign:",
    campaignDescriptionPrompt: "Please provide a short description for your campaign:",
    campaignTokenIdPrompt: "Please enter the Token ID you want to use for this campaign (format: 0.0.xxx):",
    campaignTotalAmountPrompt: "What is the total amount of tokens you want to allocate for this campaign?",
    campaignAmountPerClaimPrompt: "How many tokens should each user receive per claim?",
    campaignMaxClaimsPrompt: "What's the maximum number of claims allowed? (Enter 0 for unlimited):",
    campaignInvalidAmount: "❌ Invalid amount. Please enter a positive number.",
    campaignInvalidMaxClaims: "❌ Invalid maximum claims. Please enter a non-negative number or 'unlimited'.",
    campaignAmountTooLarge: "❌ The amount per claim cannot be larger than the total amount.",
    campaignConfirmationHeader: "📣 *Campaign Summary*",
    campaignConfirmationPrompt: "Do you want to create this campaign?",
    campaignCreating: "⏳ Creating your campaign... This may take a moment.",
    campaignCancelled: "❌ Campaign creation cancelled.",
    
    // Claim translations
    activeCampaignsHeader: "📢 *Active Campaigns*",
    noActiveCampaigns: "There are no active campaigns available right now.",
    campaignIdPrompt: "Please enter the number of the campaign you want to claim from or paste its ID:",
    airdropIdPrompt: "Please enter the Airdrop ID you want to claim from:",
    
    // Campaign management
    noUserCampaigns: "You haven't created any campaigns yet.",
    userCampaignsHeader: "🏆 *Your Campaigns*",
    campaignManagementHelp: "Use /campaigninfo <campaign_id> to see details about a specific campaign.",
    campaignIdMissing: "Please specify a campaign ID: /campaigninfo <campaign_id>",
    campaignNotFound: "❌ Campaign not found.",
    campaignManagementOptions: "To update this campaign status use:\n/campaignstatus <campaign_id> <new_status>\n\nValid statuses: active, paused, completed, cancelled",
    campaignStatusUsage: "Usage: /campaignstatus <campaign_id> <new_status>\n\nValid statuses: active, paused, completed, cancelled"
  },
  fr: {
    languageChanged: '✅ Langue changée en Français',
    languageOptions: 'Veuillez choisir une langue :\n\nPour choisir le français : /setlang fr\nTo choose English: /setlang en',
    helpText: `Bienvenue sur le Zenwa bot ! Voici les commandes disponibles :

Vous pouvez utiliser les boutons ci-dessous ou taper les commandes manuellement :

/createwallet - Créer un nouveau wallet
/balance - Vérifier le solde de votre wallet
/send - Envoyer des HBAR à un autre compte
/sendtoken - Envoyer des tokens à un autre compte
/history - Consulter l'historique de vos transactions
/mint - Créer un nouveau token
/airdrop - Créer un airdrop de tokens
/campaign - Créer une campagne de distribution
/claim - Réclamer des tokens d'une campagne
/claimairdrop - Réclamer des tokens d'un airdrop
/mycampaigns - Afficher vos campagnes
/setlang - Changer la langue (FR/EN)
/help - Afficher ce message d'aide

Vous pouvez également me poser des questions en langage naturel comme :
- "Quel est mon solde ?"
- "Envoyer 5 HBAR au compte 0.0.123456"
- "Créer un token appelé MonToken"
- "Réclamer mon airdrop" ou "Afficher mes airdrops en attente"`,
    help: "Bienvenue sur le Zenwa bot ! Sélectionnez une option ci-dessous :",
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
    fullHelpLabel: "📚 Aide complète",
    
    // Airdrop translations
    airdropIntro: "Bienvenue dans l'assistant de création d'airdrop de tokens ! Je vais vous guider pour distribuer des tokens à plusieurs destinataires.",
    airdropTokenIdPrompt: "Veuillez entrer l'ID du token que vous souhaitez distribuer (format : 0.0.xxx) :",
    airdropRecipientsPrompt: "Veuillez entrer les IDs des comptes destinataires, séparés par des virgules (ex : 0.0.12345,0.0.67890) :",
    airdropInvalidRecipients: "❌ Liste de destinataires invalide. Veuillez entrer au moins un ID de compte valide.",
    airdropAmountPrompt: "Combien de tokens souhaitez-vous envoyer à chaque destinataire ?",
    airdropInvalidAmount: "❌ Montant invalide. Veuillez entrer un nombre positif.",
    airdropConfirmationHeader: "📤 *Résumé de l'Airdrop*",
    airdropConfirmationPrompt: "Voulez-vous procéder à cet airdrop ?",
    airdropProcessing: "⏳ Traitement de votre demande d'airdrop... Cela peut prendre un moment.",
    airdropCancelled: "❌ Airdrop annulé.",
    
    // Campaign translations
    campaignIntro: "Bienvenue dans l'assistant de création de campagne ! Une campagne permet aux utilisateurs de réclamer des tokens à partir d'un pool que vous créez.",
    campaignNamePrompt: "Veuillez entrer un nom pour votre campagne :",
    campaignDescriptionPrompt: "Veuillez fournir une brève description pour votre campagne :",
    campaignTokenIdPrompt: "Veuillez entrer l'ID du token que vous souhaitez utiliser pour cette campagne (format : 0.0.xxx) :",
    campaignTotalAmountPrompt: "Quel est le montant total de tokens que vous souhaitez allouer à cette campagne ?",
    campaignAmountPerClaimPrompt: "Combien de tokens chaque utilisateur doit-il recevoir par réclamation ?",
    campaignMaxClaimsPrompt: "Quel est le nombre maximum de réclamations autorisées ? (Entrez 0 pour illimité) :",
    campaignInvalidAmount: "❌ Montant invalide. Veuillez entrer un nombre positif.",
    campaignInvalidMaxClaims: "❌ Nombre maximum de réclamations invalide. Veuillez entrer un nombre non négatif ou 'illimité'.",
    campaignAmountTooLarge: "❌ Le montant par réclamation ne peut pas être supérieur au montant total.",
    campaignConfirmationHeader: "📣 *Résumé de la Campagne*",
    campaignConfirmationPrompt: "Voulez-vous créer cette campagne ?",
    campaignCreating: "⏳ Création de votre campagne... Cela peut prendre un moment.",
    campaignCancelled: "❌ Création de la campagne annulée.",
    
    // Claim translations
    activeCampaignsHeader: "📢 *Campagnes Actives*",
    noActiveCampaigns: "Il n'y a pas de campagnes actives disponibles pour le moment.",
    campaignIdPrompt: "Veuillez entrer le numéro de la campagne dont vous souhaitez réclamer des tokens ou coller son ID :",
    airdropIdPrompt: "Veuillez entrer l'ID de l'Airdrop dont vous souhaitez réclamer les tokens :",
    
    // Campaign management
    noUserCampaigns: "Vous n'avez pas encore créé de campagnes.",
    userCampaignsHeader: "🏆 *Vos Campagnes*",
    campaignManagementHelp: "Utilisez /campaigninfo <campaign_id> pour voir les détails d'une campagne spécifique.",
    campaignIdMissing: "Veuillez spécifier un ID de campagne : /campaigninfo <campaign_id>",
    campaignNotFound: "❌ Campagne non trouvée.",
    campaignManagementOptions: "Pour mettre à jour le statut de cette campagne, utilisez :\n/campaignstatus <campaign_id> <nouveau_statut>\n\nStatuts valides : active, paused, completed, cancelled",
    campaignStatusUsage: "Utilisation : /campaignstatus <campaign_id> <nouveau_statut>\n\nStatuts valides : active, paused, completed, cancelled"
  }
};

/**
 * Fonction pour envoyer un menu d'aide avec boutons interactifs
 * @param {TelegramBot} bot - Instance du bot Telegram 
 * @param {string} userId - ID de l'utilisateur
 * @param {number} chatId - ID du chat
 * @param {string} [customMessage] - Message personnalisé à afficher au lieu du message d'aide par défaut
 */
const sendHelpWithButtons = async (bot, userId, chatId, customMessage = null) => {
  try {
    const lang = getUserLanguage(userId);
    console.log(`Generating help menu for user ${userId} with language: ${lang}`);
    
    // Créer les boutons interactifs en fonction de la langue
    // Les étiquettes sont traduites individuellement pour déboguer
    const walletLabelText = translations[lang]?.walletLabel || translations.en.walletLabel;
    const balanceLabelText = translations[lang]?.balanceLabel || translations.en.balanceLabel;
    const sendLabelText = translations[lang]?.sendLabel || translations.en.sendLabel;
    const sendTokenLabelText = translations[lang]?.sendTokenLabel || translations.en.sendTokenLabel;
    const historyLabelText = translations[lang]?.historyLabel || translations.en.historyLabel;
    const mintLabelText = translations[lang]?.mintLabel || translations.en.mintLabel;
    
    // Traductions pour les nouveaux boutons d'airdrop et de campagne
    const airdropLabelText = lang === 'fr' ? "🪂 Airdrop" : "🪂 Airdrop";
    const campaignLabelText = lang === 'fr' ? "📢 Campagne" : "📢 Campaign";
    const claimLabelText = lang === 'fr' ? "🎁 Réclamer" : "🎁 Claim";
    const myCampaignsLabelText = lang === 'fr' ? "📋 Mes Campagnes" : "📋 My Campaigns";
    
    const langLabelText = translations[lang]?.languageLabel || translations.en.languageLabel;
    const fullHelpLabelText = translations[lang]?.fullHelpLabel || translations.en.fullHelpLabel;
    
    console.log(`Menu labels for ${lang}: wallet="${walletLabelText}", balance="${balanceLabelText}"`);
    
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: walletLabelText, callback_data: 'cmd_wallet' },
            { text: balanceLabelText, callback_data: 'cmd_balance' }
          ],
          [
            { text: sendLabelText, callback_data: 'cmd_send' },
            { text: sendTokenLabelText, callback_data: 'cmd_sendtoken' }
          ],
          [
            { text: historyLabelText, callback_data: 'cmd_history' },
            { text: mintLabelText, callback_data: 'cmd_mint' }
          ],
          [
            { text: airdropLabelText, callback_data: 'cmd_airdrop' },
            { text: claimLabelText, callback_data: 'cmd_claim' }
          ],
          [
            { text: langLabelText, callback_data: 'cmd_language' },
            { text: fullHelpLabelText, callback_data: 'cmd_fullhelp' }
          ]
        ]
      }
    };
    
    // Envoyer le message avec les boutons, en utilisant le message personnalisé s'il existe
    const messageText = customMessage || translate(userId, 'help');
    await bot.sendMessage(chatId, messageText, options);
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
  
  // Ajoutons un gestionnaire pour la commande /help qui affiche le menu avec boutons
  bot.onText(/^\/help$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    console.log(`Help command from user ${userId}`);
    await sendHelpWithButtons(bot, userId, chatId);
  });
  
  // Ajoutons un gestionnaire pour la commande /start qui affiche le menu avec boutons
  bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const firstName = msg.from.first_name || 'l\'ami';
    const username = msg.from.username || null;
    console.log(`Start command from user ${userId}`);
    
    // Vérifier si l'utilisateur a déjà un portefeuille
    const { getWalletByUserId, getWalletByPhoneNumber } = require('../../storage/userWallets');
    const wallet = await getWalletByUserId(userId);
    
    // Récupérer la langue de l'utilisateur
    const lang = getUserLanguage(userId);
    
    // Message de demande de téléphone
    const phoneRequestMessage = lang === 'fr'
      ? `👋 Bonjour ${firstName} ! Pour améliorer l'identification sur notre service, veuillez entrer votre numéro de téléphone au format 0XXXXXXXXX ou +336XXXXXXXX:`
      : `👋 Hello ${firstName}! To improve identification on our service, please enter your phone number in the format 0XXXXXXXXX or +336XXXXXXXX:`;
    
    // Si l'utilisateur a déjà un portefeuille avec un numéro de téléphone, afficher le menu d'aide
    if (wallet && wallet.phoneNumber) {
      const welcomeMessage = lang === 'fr' 
        ? `👋 Rebonjour ${firstName} ! Bienvenue sur le Zenwa bot.`
        : `👋 Welcome back ${firstName}! Welcome to the Zenwa bot.`;
      
      await sendHelpWithButtons(bot, userId, chatId, welcomeMessage);
      return;
    }
    
    // Sinon, demander le numéro de téléphone
    // Importer les modules nécessaires
    const { START_STATES, userState } = require('../commands');
    
    if (wallet && !wallet.phoneNumber) {
      // Utilisateur existant sans numéro de téléphone, demander le numéro
      userState.set(userId, {
        state: START_STATES.WAITING_FOR_PHONE,
        chatId: chatId,
        userData: {
          username,
          accountId: wallet.accountId
        }
      });
      
      await bot.sendMessage(
        chatId,
        phoneRequestMessage,
        { 
          reply_markup: { 
            force_reply: true 
          } 
        }
      );
      return;
    }
    
    // Nouvel utilisateur, demander le numéro de téléphone avant de créer un portefeuille
    userState.set(userId, {
      state: START_STATES.WAITING_FOR_PHONE,
      chatId: chatId,
      userData: {
        username
      }
    });
    
    await bot.sendMessage(
      chatId,
      phoneRequestMessage,
      { 
        reply_markup: { 
          force_reply: true 
        } 
      }
    );
  });
  
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
      // Exécuter la commande directement au lieu de simuler
      const { handleCreateWallet } = require('../commands');
      await handleCreateWallet(bot, { chat: { id: chatId }, from: callbackQuery.from });
    }
    else if (action === 'cmd_balance') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'balanceInfo') });
      // Exécuter la commande directement au lieu de simuler
      const simulatedMsg = { 
        chat: { id: chatId }, 
        from: callbackQuery.from,
        text: '/balance'  // Ajouter un texte pour éviter l'erreur
      };
      const { handleBalance } = require('../commands');
      await handleBalance(bot, simulatedMsg);
    }
    else if (action === 'cmd_send') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'sendInfo') });
      // Exécuter la commande directement au lieu de simuler
      // Créer un objet message synthétique pour simuler une commande
      const simulatedMsg = { 
        chat: { id: chatId }, 
        from: callbackQuery.from,
        text: '/send'  // Ajouter un texte pour éviter l'erreur
      };
      const { handleSend } = require('../commands');
      await handleSend(bot, simulatedMsg);
    }
    else if (action === 'cmd_sendtoken') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'sendTokenInfo') });
      // Exécuter la commande directement au lieu de simuler
      // Créer un objet message synthétique pour simuler une commande
      const simulatedMsg = { 
        chat: { id: chatId }, 
        from: callbackQuery.from,
        text: '/sendtoken'  // Ajouter un texte pour éviter l'erreur
      };
      const { handleSendToken } = require('../commands');
      await handleSendToken(bot, simulatedMsg);
    }
    else if (action === 'cmd_history') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'historyInfo') });
      // Exécuter la commande directement au lieu de simuler
      const { handleHistory } = require('../commands');
      await handleHistory(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/history' });
    }
    else if (action === 'cmd_mint') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: translate(userId, 'mintInfo') });
      // Exécuter la commande directement au lieu de simuler
      const { handleMint } = require('../commands');
      await handleMint(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/mint' });
    }
    else if (action === 'cmd_airdrop') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Airdrop tokens' });
      // Exécuter la commande directement au lieu de simuler
      const { handleAirdrop } = require('../airdrop-commands');
      await handleAirdrop(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/airdrop' });
    }
    else if (action === 'cmd_claim') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Claim tokens' });
      // Exécuter la commande directement au lieu de simuler
      const { handleClaim } = require('../airdrop-commands');
      await handleClaim(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/claim' });
    }
    else if (action === 'airdrop_add_recipient' || action === 'airdrop_finalize') {
      // Utiliser le nouveau gestionnaire de boutons
      const { handleButtonAction } = require('../button-handlers');
      const handled = await handleButtonAction(callbackQuery);
      
      if (!handled) {
        // Si non géré, afficher un message générique
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Action non disponible' });
        await bot.sendMessage(
          chatId, 
          getUserLanguage(userId) === 'fr' ?
            "❌ Une erreur est survenue. Veuillez réessayer." :
            "❌ An error occurred. Please try again."
        );
      }
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
  translate,
  sendHelpWithButtons
};