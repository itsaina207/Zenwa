/**
 * Telegram bot command handlers
 */

const { createAccount, getBalance, sendHbar } = require('../hedera/account');
const { getTransactionHistory } = require('../hedera/transactions');
const { mintToken, sendToken } = require('../hedera/tokens');
const { processNaturalLanguageCommand } = require('../agent/nlp-processor');
const { getAgent } = require('../agent/hedera-agent');

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

✨ *NOUVEAU* : Je comprends maintenant le langage naturel ! 
Vous pouvez me parler normalement pour gérer votre wallet !

Commençons ! Utilisez /createwallet pour créer votre premier wallet.
  `;
  
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
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

*Nouveau : Commandes en langage naturel !*
Vous pouvez maintenant interagir avec votre wallet en utilisant des phrases simples !

*Exemples :*
- "Quel est mon solde ?" ou "Montre-moi ma balance"
- "Envoyer 5 HBAR à 0.0.1234" 
- "Voir mon historique de transactions"
- "Créer un token nommé MonToken avec symbole MTK"
- "Envoyer 10 tokens 0.0.5678 à 0.0.1234"

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
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  
  // Vérifier si l'utilisateur est en cours de processus d'envoi
  if (userInfo) {
    // Traitement des étapes de la conversation en cours
    const currentChatId = userInfo.chatId;
    
    // Gestion des différentes étapes de la conversation
    switch (userInfo.state) {
      case SEND_STATES.WAITING_FOR_ADDRESS:
        // L'utilisateur a fourni l'adresse de destination
        userInfo.toAccountId = text;
        userInfo.state = SEND_STATES.WAITING_FOR_AMOUNT;
        userState.set(userId, userInfo);
        
        // Demander le montant à envoyer
        await bot.sendMessage(
          currentChatId,
          `Quelle quantité de HBAR souhaitez-vous envoyer à ${text}?`,
          { reply_markup: { force_reply: true } }
        );
        return;
        
      case SEND_STATES.WAITING_FOR_AMOUNT:
        // L'utilisateur a fourni le montant
        const amount = text;
        const toAccountId = userInfo.toAccountId;
        
        // Réinitialiser l'état
        userState.set(userId, { ...userInfo, state: SEND_STATES.NONE });
        
        // Informer l'utilisateur que la transaction est en cours
        await bot.sendMessage(currentChatId, `Envoi de ${amount} HBAR à ${toAccountId} en cours...`);
        
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
          await bot.sendMessage(currentChatId, message, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(currentChatId, `❌ ${result.message}`);
        }
        return;
    }
  }
  
  // Si l'utilisateur n'est pas dans une conversation ou a terminé, traiter le message comme une commande en langage naturel
  await handleNaturalLanguage(bot, msg);
}

/**
 * Traite les messages en langage naturel
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Objet message de Telegram
 */
async function handleNaturalLanguage(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text.trim();
  
  // Ignorer les messages vides
  if (!text) return;
  
  // Informer l'utilisateur que sa demande est en cours de traitement
  await bot.sendMessage(chatId, "Je traite votre demande avec intelligence artificielle...");
  
  try {
    // Utiliser l'agent Hedera avec le LLM pour traiter la commande
    const agent = getAgent();
    const result = await agent.executeCommand(userId, text);
    
    if (result.success) {
      // Formater le message en fonction du type d'action
      let message;
      
      switch (result.action) {
        case 'balance':
          message = `💰 *Solde*\n\n${result.message}`;
          break;
        case 'history':
          message = `📜 *Historique des transactions*\n\n${result.message}`;
          break;
        case 'send_hbar':
          message = `✅ *Transfert HBAR*\n\n${result.message}`;
          break;
        case 'send_token':
          message = `✅ *Transfert de token*\n\n${result.message}`;
          break;
        case 'mint_token':
          message = `🪙 *Création de token*\n\n${result.message}`;
          break;
        default:
          message = result.message;
      }
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      // En cas d'erreur ou de commande non reconnue
      await bot.sendMessage(
        chatId, 
        `${result.message}\n\nVous pouvez utiliser /help pour voir la liste des commandes disponibles.`
      );
    }
  } catch (error) {
    console.error(`Error processing natural language: ${error.message}`);
    await bot.sendMessage(
      chatId,
      "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou utiliser les commandes spécifiques comme /balance, /send, etc."
    );
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
  
  // Handler for conversation flow and natural language
  bot.on('message', msg => {
    // Ignorer les commandes (qui commencent par '/')
    if (msg.text && !msg.text.startsWith('/')) {
      // Vérifier d'abord si nous sommes au milieu d'une conversation structurée
      const userId = msg.from.id.toString();
      const userInfo = userState.get(userId);
      
      if (userInfo && userInfo.state !== SEND_STATES.NONE) {
        // Si l'utilisateur est dans une conversation, continuer celle-ci
        handleSendConversation(bot, msg);
      } else {
        // Sinon, traiter comme langage naturel
        handleNaturalLanguage(bot, msg);
      }
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
