/**
 * Système de localisation pour les messages du bot Telegram
 * Ce module gère les traductions françaises et anglaises
 */

// Stockage temporaire des préférences de langue par utilisateur
// En production, vous pourriez vouloir stocker cela en base de données
const userLanguages = {};

// Langues disponibles
const LANGUAGES = {
  FR: 'fr',
  EN: 'en'
};

// Langue par défaut
const DEFAULT_LANGUAGE = LANGUAGES.FR;

/**
 * Définit la langue préférée d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} language - Code de langue ('fr' ou 'en')
 */
function setUserLanguage(userId, language) {
  // Vérifier que la langue est valide
  if (Object.values(LANGUAGES).includes(language)) {
    userLanguages[userId] = language;
    return true;
  }
  return false;
}

/**
 * Récupère la langue préférée d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {string} Code de langue ('fr' ou 'en')
 */
function getUserLanguage(userId) {
  return userLanguages[userId] || DEFAULT_LANGUAGE;
}

/**
 * Récupère une traduction en fonction de la langue de l'utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} key - Clé de traduction
 * @returns {string} Texte traduit
 */
function getTranslation(userId, key) {
  const language = getUserLanguage(userId);
  return translations[key] ? (translations[key][language] || key) : key;
}

/**
 * Traduit un message avec des variables
 * @param {string} userId - ID de l'utilisateur
 * @param {string} key - Clé de traduction
 * @param {object} variables - Variables à insérer dans le message
 * @returns {string} Message traduit avec variables
 */
function translate(userId, key, variables = {}) {
  let text = getTranslation(userId, key);
  
  // Remplacer les variables
  Object.keys(variables).forEach(varName => {
    const placeholder = `{{${varName}}}`;
    text = text.replace(new RegExp(placeholder, 'g'), variables[varName]);
  });
  
  return text;
}

// Dictionnaire de traductions
const translations = {
  // Messages généraux
  'welcome': {
    'fr': 'Bienvenue sur le bot de wallet Hedera! Utilisez /help pour voir les commandes disponibles.',
    'en': 'Welcome to the Hedera wallet bot! Use /help to see available commands.'
  },
  'help': {
    'fr': 'Commandes disponibles :\n' +
          '/start - Démarrer le bot\n' +
          '/help - Afficher l\'aide\n' +
          '/createwallet - Créer un nouveau wallet\n' +
          '/balance - Vérifier votre solde\n' +
          '/send - Envoyer des HBAR\n' +
          '/mint - Créer un nouveau token\n' +
          '/sendtoken - Envoyer des tokens\n' +
          '/history - Voir l\'historique des transactions\n' +
          '/airdrop - Créer un airdrop de tokens\n' +
          '/campaign - Créer une campagne de distribution\n' +
          '/claim - Réclamer des tokens d\'une campagne\n' +
          '/claimairdrop - Réclamer des tokens d\'un airdrop\n' +
          '/mycampaigns - Afficher vos campagnes\n' +
          '/language - Changer la langue du bot\n\n' +
          'Vous pouvez aussi utiliser des commandes en langage naturel comme :\n' +
          '"Quel est mon solde?" ou "Crée un token"\n' +
          '"Réclamer mon airdrop" ou "Afficher mes airdrops en attente"',
    'en': 'Available commands:\n' +
          '/start - Start the bot\n' +
          '/help - Show help\n' +
          '/createwallet - Create a new wallet\n' +
          '/balance - Check your balance\n' +
          '/send - Send HBAR\n' +
          '/mint - Create a new token\n' +
          '/sendtoken - Send tokens\n' +
          '/history - View transaction history\n' +
          '/airdrop - Create a token airdrop\n' +
          '/campaign - Create a token campaign\n' +
          '/claim - Claim tokens from a campaign\n' +
          '/claimairdrop - Claim tokens from an airdrop\n' +
          '/mycampaigns - View your campaigns\n' +
          '/language - Change bot language\n\n' +
          'You can also use natural language commands like:\n' +
          '"What\'s my balance?" or "Create a token"\n' +
          '"Claim my airdrop" or "Show my pending airdrops"'
  },
  'language_selection': {
    'fr': 'Veuillez choisir une langue :',
    'en': 'Please select a language:'
  },
  'language_changed': {
    'fr': '✅ Langue changée en Français',
    'en': '✅ Language changed to English'
  },
  'error': {
    'fr': '❌ Erreur: {{message}}',
    'en': '❌ Error: {{message}}'
  },
  
  // Wallet
  'wallet_created': {
    'fr': '✅ Wallet créé avec succès!\n\n' +
          'Account ID: {{accountId}}\n' +
          'EVM Address: {{evmAddress}}\n' +
          'Public Key: {{publicKey}}\n\n' +
          '⚠️ IMPORTANT: Sauvegardez votre clé privée en lieu sûr:\n' +
          '{{privateKey}}\n\n' +
          'Transaction ID: {{transactionId}}\n' +
          'Voir dans l\'explorateur: {{explorerUrl}}',
    'en': '✅ Wallet successfully created!\n\n' +
          'Account ID: {{accountId}}\n' +
          'EVM Address: {{evmAddress}}\n' +
          'Public Key: {{publicKey}}\n\n' +
          '⚠️ IMPORTANT: Save your private key in a secure location:\n' +
          '{{privateKey}}\n\n' +
          'Transaction ID: {{transactionId}}\n' +
          'View in explorer: {{explorerUrl}}'
  },
  'wallet_exists': {
    'fr': 'Vous avez déjà un wallet avec l\'ID {{accountId}}',
    'en': 'You already have a wallet with ID {{accountId}}'
  },
  'no_wallet': {
    'fr': 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
    'en': 'No wallet found. Create one first with /createwallet'
  },
  'balance': {
    'fr': '💰 Solde de votre wallet\n\n' +
          'Account ID: {{accountId}}\n' +
          'HBAR: {{hbars}}\n\n' +
          '🪙 Tokens:\n{{tokens}}',
    'en': '💰 Your wallet balance\n\n' +
          'Account ID: {{accountId}}\n' +
          'HBAR: {{hbars}}\n\n' +
          '🪙 Tokens:\n{{tokens}}'
  },
  'no_tokens': {
    'fr': 'Aucun token',
    'en': 'No tokens'
  },
  
  // Transactions
  'ask_recipient': {
    'fr': 'Veuillez entrer l\'ID du compte destinataire:',
    'en': 'Please enter the recipient account ID:'
  },
  'ask_amount': {
    'fr': 'Veuillez entrer le montant à envoyer:',
    'en': 'Please enter the amount to send:'
  },
  'transfer_success': {
    'fr': '✅ Transfert réussi!\n\n' +
          'Destinataire: {{recipient}}\n' +
          'Montant: {{amount}} HBAR\n' +
          'Transaction ID: {{transactionId}}\n' +
          'Voir dans l\'explorateur: {{explorerUrl}}',
    'en': '✅ Transfer successful!\n\n' +
          'Recipient: {{recipient}}\n' +
          'Amount: {{amount}} HBAR\n' +
          'Transaction ID: {{transactionId}}\n' +
          'View in explorer: {{explorerUrl}}'
  },
  'insufficient_funds': {
    'fr': '❌ Fonds insuffisants. Votre solde est de {{balance}} HBAR.',
    'en': '❌ Insufficient funds. Your balance is {{balance}} HBAR.'
  },
  
  // Tokens
  'token_type_selection': {
    'fr': 'Quel type de token souhaitez-vous créer?',
    'en': 'What type of token would you like to create?'
  },
  'fungible': {
    'fr': 'Fongible',
    'en': 'Fungible'
  },
  'non_fungible': {
    'fr': 'Non Fongible (NFT)',
    'en': 'Non-Fungible (NFT)'
  },
  'token_name_prompt': {
    'fr': 'Veuillez entrer un nom pour votre token:',
    'en': 'Please enter a name for your token:'
  },
  'token_symbol_prompt': {
    'fr': 'Veuillez entrer un symbole pour votre token (ex: BTC, ETH):',
    'en': 'Please enter a symbol for your token (e.g. BTC, ETH):'
  },
  'token_symbol_suggestion': {
    'fr': 'Voulez-vous utiliser {{symbol}} comme symbole pour votre token?',
    'en': 'Do you want to use {{symbol}} as the symbol for your token?'
  },
  'token_supply_prompt': {
    'fr': 'Veuillez entrer l\'offre initiale pour votre token (max 100,000,000):',
    'en': 'Please enter the initial supply for your token (max 100,000,000):'
  },
  'token_created': {
    'fr': '✅ Token créé avec succès!\n\n' +
          'Nom: {{name}}\n' +
          'Symbole: {{symbol}}\n' +
          'Token ID: {{tokenId}}\n' +
          'Supply: {{supply}}\n' +
          'Transaction ID: {{transactionId}}\n' +
          'Voir dans l\'explorateur: {{explorerUrl}}',
    'en': '✅ Token successfully created!\n\n' +
          'Name: {{name}}\n' +
          'Symbol: {{symbol}}\n' +
          'Token ID: {{tokenId}}\n' +
          'Supply: {{supply}}\n' +
          'Transaction ID: {{transactionId}}\n' +
          'View in explorer: {{explorerUrl}}'
  },
  'supply_limit_exceeded': {
    'fr': '⚠️ L\'offre maximale est limitée à 100,000,000 unités. Votre valeur a été ajustée.',
    'en': '⚠️ Maximum supply is limited to 100,000,000 units. Your value has been adjusted.'
  },
  
  // Historique
  'transaction_history': {
    'fr': '📜 Historique des transactions pour {{accountId}}\n\n{{transactions}}',
    'en': '📜 Transaction history for {{accountId}}\n\n{{transactions}}'
  },
  'transaction_item': {
    'fr': '🔹 {{date}} - {{type}} - {{amount}}\n    ID: {{id}}\n    Explorer: {{url}}\n',
    'en': '🔹 {{date}} - {{type}} - {{amount}}\n    ID: {{id}}\n    Explorer: {{url}}\n'
  },
  'no_transactions': {
    'fr': 'Aucune transaction trouvée.',
    'en': 'No transactions found.'
  }
};

module.exports = {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  setUserLanguage,
  getUserLanguage,
  translate
};