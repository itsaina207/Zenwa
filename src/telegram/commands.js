/**
 * Telegram bot command handlers
 */

const { createAccount, getBalance, sendHbar } = require('../hedera/account');
const { getTransactionHistory } = require('../hedera/transactions');
const { mintToken, sendToken } = require('../hedera/tokens');

// State management for multi-step operations
const userState = new Map();

// Possible states for the /send command
const SEND_STATES = {
  WAITING_FOR_ADDRESS: 'WAITING_FOR_ADDRESS',
  WAITING_FOR_AMOUNT: 'WAITING_FOR_AMOUNT',
  NONE: 'NONE'
};

/**
 * Handles the /start command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'l\'ami';
  
  const message = `
Bonjour ${firstName} ! 👋

Bienvenue sur le Bot de Wallet Custodial Hedera. Je peux vous aider à gérer vos HBAR et vos tokens sur le réseau Hedera.

Commandes disponibles :
/createwallet - Créer un nouveau wallet
/balance - Vérifier le solde de votre wallet
/send - Envoyer des HBAR à un autre compte
/sendtoken - Envoyer des tokens à un autre compte
/history - Consulter l'historique de vos transactions
/mint - Créer un nouveau token
/help - Afficher ce message d'aide

Commençons ! Utilisez /createwallet pour créer votre premier wallet.
  `;
  
  await bot.sendMessage(chatId, message);
}

/**
 * Handles the /help command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleHelp(bot, msg) {
  const chatId = msg.chat.id;
  
  const message = `
*Aide du Bot de Wallet Custodial Hedera*

Commandes disponibles :

/createwallet - Créer un nouveau compte Hedera
/balance - Vérifier le solde de votre wallet
/send _<accountId> <montant>_ - Envoyer des HBAR à un autre compte
/sendtoken _<accountId> <tokenId> <montant>_ - Envoyer des tokens à un autre compte
/history - Consulter l'historique de vos transactions
/mint _<nom> <symbole> <offre>_ - Créer un nouveau token (tous les paramètres sont optionnels)
/help - Afficher ce message d'aide

*Exemples :*
- Envoyer 5 HBAR : /send 0.0.1234 5
- Envoyer 10 tokens : /sendtoken 0.0.1234 0.0.5678 10
- Créer un token : /mint MonToken MTK 1000

Ce wallet est custodial - vos clés privées sont stockées en toute sécurité sur notre serveur.
  `;
  
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

/**
 * Handles the /createwallet command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleCreateWallet(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  await bot.sendMessage(chatId, 'Création de votre wallet Hedera en cours... Cela peut prendre un moment.');
  
  const result = await createAccount(userId);
  
  if (result.success) {
    const message = `
✅ ${result.message}

*Vos informations de compte Hedera :*

Account ID: \`${result.accountId}\`
EVM Address: \`${result.evmAddress}\`

*Clés du compte :*
Private Key: \`${result.privateKey}\`
Public Key: \`${result.publicKey}\`

*Transaction :*
Transaction ID: \`${result.transactionId}\`
[Voir dans l'explorateur](${result.explorerUrl})

IMPORTANT : Conservez ces informations en lieu sûr, surtout la clé privée.
Utilisez /balance pour vérifier votre solde.
`;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ ${result.message}`);
  }
}

/**
 * Handles the /balance command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleBalance(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  await bot.sendMessage(chatId, 'Vérification de votre solde en cours...');
  
  const result = await getBalance(userId);
  
  if (result.success) {
    let tokenList = '';
    if (typeof result.balance.tokens === 'string') {
      tokenList = result.balance.tokens;
    } else {
      tokenList = Object.entries(result.balance.tokens)
        .map(([tokenId, amount]) => `${tokenId}: ${amount}`)
        .join('\n');
      
      if (!tokenList) tokenList = 'Aucun token';
    }
    
    const message = `
💰 *Solde de votre Wallet Hedera*

*Informations du compte :*
Account ID: \`${result.accountId}\`

*Solde :*
HBAR: ${result.balance.hbars}

*Tokens :*
${tokenList}

Utilisez /send pour envoyer des HBAR à un autre compte.
Utilisez /sendtoken pour envoyer des tokens à un autre compte.
Utilisez /mint pour créer un nouveau token.
`;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ ${result.message}`);
  }
}

/**
 * Handles the /send command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleSend(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Réinitialiser l'état pour commencer une nouvelle transaction
  userState.set(userId, {
    state: SEND_STATES.WAITING_FOR_ADDRESS,
    chatId: chatId,
    toAccountId: null,
    amount: null
  });
  
  // Demander l'adresse de destination
  await bot.sendMessage(
    chatId, 
    "À quelle adresse Hedera souhaitez-vous envoyer des HBAR? (format: 0.0.xxxx)",
    { reply_markup: { force_reply: true } }
  );
}

/**
 * Handles the /history command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleHistory(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const args = msg.text.split(' ').slice(1);
  
  const limit = args[0] ? parseInt(args[0], 10) : 5;
  
  await bot.sendMessage(chatId, 'Récupération de votre historique de transactions...');
  
  const result = await getTransactionHistory(userId, limit);
  
  if (result.success) {
    if (result.transactions.length === 0) {
      await bot.sendMessage(
        chatId,
        `Aucune transaction trouvée pour le compte ${result.accountId}`
      );
      return;
    }
    
    let message = `📜 *Historique des Transactions*\n\nCompte: \`${result.accountId}\`\n\n`;
    
    result.transactions.forEach((tx, index) => {
      message += `*${index + 1}. ${tx.type}*\n`;
      message += `Date: ${new Date(tx.timestamp).toLocaleString()}\n`;
      message += `Statut: ${tx.result}\n`;
      message += `Frais: ${tx.fee} HBAR\n`;
      message += `[Voir dans l'explorateur](${tx.explorerUrl})\n\n`;
    });
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ ${result.message}`);
  }
}

/**
 * Handles the /mint command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleMint(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const args = msg.text.split(' ').slice(1);
  
  const tokenInfo = {};
  
  if (args.length >= 1) tokenInfo.name = args[0];
  if (args.length >= 2) tokenInfo.symbol = args[1];
  if (args.length >= 3) tokenInfo.initialSupply = parseInt(args[2], 10);
  
  await bot.sendMessage(chatId, 'Création de votre token en cours... Cela peut prendre un moment.');
  
  const result = await mintToken(userId, tokenInfo);
  
  if (result.success) {
    const message = `
✅ ${result.message}

*Informations du token :*
Token ID: \`${result.tokenId}\`
Nom: ${result.tokenName}
Symbole: ${result.tokenSymbol}
Offre initiale: ${result.initialSupply}

[Voir dans l'explorateur](${result.explorerUrl})

Utilisez /balance pour voir votre nouveau token dans votre portefeuille.
`;
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ ${result.message}`);
  }
}

/**
 * Handles the /sendtoken command
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleSendToken(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const args = msg.text.split(' ').slice(1);
  
  if (args.length < 3) {
    await bot.sendMessage(
      chatId,
      'Veuillez fournir un ID de compte, un ID de token et un montant.\nUtilisation: /sendtoken <accountId> <tokenId> <montant>'
    );
    return;
  }
  
  const toAccountId = args[0];
  const tokenId = args[1];
  const amount = parseInt(args[2], 10);
  
  await bot.sendMessage(chatId, `Envoi de ${amount} tokens (${tokenId}) à ${toAccountId} en cours...`);
  
  const result = await sendToken(userId, toAccountId, tokenId, amount);
  
  if (result.success) {
    const message = `
✅ ${result.message}

*Détails de la transaction :*
Token ID: \`${result.tokenId}\`
Transaction ID: \`${result.transactionId}\`

[Voir dans l'explorateur](${result.explorerUrl})

Utilisez /balance pour vérifier votre nouveau solde.
`;
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ ${result.message}`);
  }
}

/**
 * Handle conversation steps for sending HBAR
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleSendConversation(bot, msg) {
  const userId = msg.from.id.toString();
  const userInfo = userState.get(userId);
  
  // Vérifier si l'utilisateur est en cours de processus d'envoi
  if (!userInfo) return;
  
  const chatId = userInfo.chatId;
  const text = msg.text.trim();
  
  // Gestion des différentes étapes de la conversation
  switch (userInfo.state) {
    case SEND_STATES.WAITING_FOR_ADDRESS:
      // L'utilisateur a fourni l'adresse de destination
      userInfo.toAccountId = text;
      userInfo.state = SEND_STATES.WAITING_FOR_AMOUNT;
      userState.set(userId, userInfo);
      
      // Demander le montant à envoyer
      await bot.sendMessage(
        chatId,
        `Quelle quantité de HBAR souhaitez-vous envoyer à ${text}?`,
        { reply_markup: { force_reply: true } }
      );
      break;
      
    case SEND_STATES.WAITING_FOR_AMOUNT:
      // L'utilisateur a fourni le montant
      const amount = text;
      const toAccountId = userInfo.toAccountId;
      
      // Réinitialiser l'état
      userState.set(userId, { ...userInfo, state: SEND_STATES.NONE });
      
      // Informer l'utilisateur que la transaction est en cours
      await bot.sendMessage(chatId, `Envoi de ${amount} HBAR à ${toAccountId} en cours...`);
      
      // Effectuer la transaction
      const result = await sendHbar(userId, toAccountId, amount);
      
      // Afficher le résultat
      if (result.success) {
        const message = `
✅ ${result.message}

*Détails de la transaction :*
Transaction ID: \`${result.transactionId}\`

[Voir dans l'explorateur](${result.explorerUrl})

Utilisez /balance pour vérifier votre nouveau solde.
`;
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, `❌ ${result.message}`);
      }
      break;
      
    default:
      break;
  }
}

/**
 * Register all command handlers with the bot
 * @param {TelegramBot} bot - Telegram bot instance
 */
function registerCommands(bot) {
  // Define command handlers
  bot.onText(/\/start/, msg => handleStart(bot, msg));
  bot.onText(/\/help/, msg => handleHelp(bot, msg));
  bot.onText(/\/createwallet/, msg => handleCreateWallet(bot, msg));
  bot.onText(/\/balance/, msg => handleBalance(bot, msg));
  bot.onText(/\/send(.*)/, msg => handleSend(bot, msg));
  bot.onText(/\/sendtoken(.*)/, msg => handleSendToken(bot, msg));
  bot.onText(/\/history(.*)/, msg => handleHistory(bot, msg));
  bot.onText(/\/mint(.*)/, msg => handleMint(bot, msg));
  
  // Handler for conversation flow
  bot.on('message', msg => {
    // Ignorer les commandes (qui commencent par '/')
    if (msg.text && !msg.text.startsWith('/')) {
      handleSendConversation(bot, msg);
    }
  });
  
  // Set up bot commands for Telegram menu
  bot.setMyCommands([
    { command: "createwallet", description: "Créer un nouveau wallet" },
    { command: "balance", description: "Vérifier le solde de votre wallet" },
    { command: "send", description: "Envoyer des HBAR à un autre compte" },
    { command: "sendtoken", description: "Envoyer des tokens à un autre compte" },
    { command: "history", description: "Consulter l'historique de vos transactions" },
    { command: "mint", description: "Créer un nouveau token" },
    { command: "help", description: "Afficher de l'aide" },
  ]);
}

module.exports = {
  registerCommands,
};
