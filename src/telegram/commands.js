/**
 * Telegram bot command handlers
 */

const { createAccount, getBalance, sendHbar } = require('../hedera/account');
const { getTransactionHistory } = require('../hedera/transactions');
const { mintToken, sendToken } = require('../hedera/tokens');
const { createTopic, submitTopicMessage, getTopicMessages } = require('../hedera/topic-management');
const { analyzeIntent, isBalanceCheck, isHistoryCheck, isCreateTokenRequest } = require('../services/openai-service');

// State management for multi-step operations
const userState = new Map();

// Possible states for the /send command
const SEND_STATES = {
  WAITING_FOR_ADDRESS: 'WAITING_FOR_ADDRESS',
  WAITING_FOR_AMOUNT: 'WAITING_FOR_AMOUNT',
  NONE: 'NONE'
};

// Possible states for the /mint command
const MINT_STATES = {
  WAITING_FOR_TYPE: 'WAITING_FOR_TYPE',
  WAITING_FOR_NAME: 'WAITING_FOR_NAME',
  WAITING_FOR_SYMBOL: 'WAITING_FOR_SYMBOL',
  WAITING_FOR_SUPPLY: 'WAITING_FOR_SUPPLY',
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

Vous pouvez aussi me parler directement en langage naturel ! Par exemple, essayez "Quel est mon solde ?" ou "Crée un nouveau wallet pour moi".

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

*Commandes en langage naturel :*
Vous pouvez également me parler directement en langage naturel. Par exemple :
• "Quel est mon solde ?"
• "Envoie 10 HBAR à 0.0.12345"
• "Crée un token Test avec le symbole TST"
• "Affiche mon historique de transactions"
• "Crée un topic nommé MonTopic"

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
  
  // Si des arguments sont fournis, utiliser l'ancienne méthode directe
  if (args.length > 0) {
    const tokenInfo = {};
    
    if (args.length >= 1) tokenInfo.name = args[0];
    if (args.length >= 2) tokenInfo.symbol = args[1];
    if (args.length >= 3) {
      const supply = parseInt(args[2], 10);
      const MAX_SUPPLY = 100000000; // 100 millions
      if (supply > MAX_SUPPLY) {
        await bot.sendMessage(chatId, `⚠️ La supply maximale autorisée est de ${MAX_SUPPLY}. Votre valeur (${supply}) sera limitée à ce maximum.`);
        tokenInfo.initialSupply = MAX_SUPPLY;
      } else {
        tokenInfo.initialSupply = supply;
      }
    }
    
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
    return;
  }
  
  // Sinon, démarrer le processus interactif de création de token
  // Réinitialiser l'état pour commencer une nouvelle création de token
  userState.set(userId, {
    state: MINT_STATES.WAITING_FOR_TYPE,
    chatId: chatId,
    tokenInfo: {
      type: null,
      name: null,
      symbol: null,
      initialSupply: null
    }
  });
  
  // Demander le type de token
  await bot.sendMessage(
    chatId, 
    "Quel type de token souhaitez-vous créer?\n\n1️⃣ - Token Fongible (comme une monnaie, divisible)\n2️⃣ - Token Non-Fongible (NFT, unique)",
    { 
      reply_markup: {
        keyboard: [['1️⃣ Fongible', '2️⃣ Non-Fongible']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    }
  );
}

/**
 * Handle conversation steps for creating a token
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleMintConversation(bot, msg) {
  const userId = msg.from.id.toString();
  const userInfo = userState.get(userId);
  const msgChatId = msg.chat.id;
  const text = msg.text.trim();
  
  // Vérifier si l'utilisateur est en cours de processus de création de token
  if (userInfo && userInfo.tokenInfo) {
    // Traitement des étapes de la conversation en cours
    const currentChatId = userInfo.chatId;
    
    // Gestion des différentes étapes de la conversation
    switch (userInfo.state) {
      case MINT_STATES.WAITING_FOR_TYPE:
        // L'utilisateur a choisi le type de token
        let tokenType = '';
        if (text.includes('1') || text.toLowerCase().includes('fongible')) {
          tokenType = 'FUNGIBLE';
        } else if (text.includes('2') || text.toLowerCase().includes('non-fongible') || text.toLowerCase().includes('nft')) {
          tokenType = 'NON_FUNGIBLE';
          await bot.sendMessage(
            currentChatId,
            "Les tokens non-fongibles (NFT) ne sont pas encore supportés. Nous allons créer un token fongible à la place."
          );
          tokenType = 'FUNGIBLE'; // Par défaut pour l'instant
        } else {
          await bot.sendMessage(
            currentChatId,
            "Je n'ai pas compris votre choix. Veuillez choisir 1 pour Fongible ou 2 pour Non-Fongible."
          );
          return;
        }
        
        userInfo.tokenInfo.type = tokenType;
        userInfo.state = MINT_STATES.WAITING_FOR_NAME;
        userState.set(userId, userInfo);
        
        // Demander le nom du token
        await bot.sendMessage(
          currentChatId,
          "Quel nom souhaitez-vous donner à votre token?",
          { reply_markup: { force_reply: true, remove_keyboard: true } }
        );
        return;
        
      case MINT_STATES.WAITING_FOR_NAME:
        // L'utilisateur a fourni le nom du token
        userInfo.tokenInfo.name = text;
        userInfo.state = MINT_STATES.WAITING_FOR_SYMBOL;
        userState.set(userId, userInfo);
        
        // Générer un symbole par défaut
        let suggestedSymbol = '';
        if (text.includes(' ')) {
          // Nom composé, utiliser les initiales
          suggestedSymbol = text.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('');
          
          // Limiter à 5 caractères maximum
          suggestedSymbol = suggestedSymbol.substring(0, 5);
        } else {
          // Nom simple, prendre les 3-4 premières lettres
          suggestedSymbol = text.substring(0, 4).toUpperCase();
        }
        
        // Demander le symbole du token
        await bot.sendMessage(
          currentChatId,
          `Quel symbole souhaitez-vous utiliser pour votre token?\n(Suggestion: ${suggestedSymbol})`,
          { reply_markup: { force_reply: true } }
        );
        return;
        
      case MINT_STATES.WAITING_FOR_SYMBOL:
        // L'utilisateur a fourni le symbole du token
        userInfo.tokenInfo.symbol = text;
        userInfo.state = MINT_STATES.WAITING_FOR_SUPPLY;
        userState.set(userId, userInfo);
        
        // Demander la supply initiale
        await bot.sendMessage(
          currentChatId,
          "Quelle quantité initiale de tokens souhaitez-vous créer?\n(Maximum: 100 000 000, par défaut: 1000)",
          { reply_markup: { force_reply: true } }
        );
        return;
        
      case MINT_STATES.WAITING_FOR_SUPPLY:
        // L'utilisateur a fourni la supply
        let supply = parseInt(text, 10);
        const MAX_SUPPLY = 100000000; // 100 millions
        
        // Valider la supply
        if (isNaN(supply)) {
          supply = 1000; // Valeur par défaut si la conversion échoue
        } else if (supply > MAX_SUPPLY) {
          await bot.sendMessage(
            currentChatId, 
            `⚠️ La supply maximale autorisée est de ${MAX_SUPPLY}. Votre valeur (${supply}) sera limitée à ce maximum.`
          );
          supply = MAX_SUPPLY;
        } else if (supply <= 0) {
          supply = 1000; // Valeur par défaut si négative ou zéro
          await bot.sendMessage(
            currentChatId,
            "La supply doit être positive. Nous utiliserons la valeur par défaut de 1000."
          );
        }
        
        userInfo.tokenInfo.initialSupply = supply;
        
        // Réinitialiser l'état
        userState.set(userId, { ...userInfo, state: MINT_STATES.NONE });
        
        // Créer le token
        await bot.sendMessage(
          currentChatId,
          `Création de votre token en cours...\n\nNom: ${userInfo.tokenInfo.name}\nSymbole: ${userInfo.tokenInfo.symbol}\nOffre initiale: ${userInfo.tokenInfo.initialSupply}\n\nCela peut prendre un moment.`
        );
        
        const result = await mintToken(userId, userInfo.tokenInfo);
        
        if (result.success) {
          const message = `
✅ ${result.message}

*Informations du token :*
Token ID: \`${result.tokenId}\`
Nom: ${result.tokenName}
Symbole: ${result.tokenSymbol}
Offre initiale: ${userInfo.tokenInfo.initialSupply}

[Voir dans l'explorateur](${result.explorerUrl})

Utilisez /balance pour voir votre nouveau token dans votre portefeuille.
`;
          await bot.sendMessage(currentChatId, message, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(currentChatId, `❌ ${result.message}`);
        }
        return;
    }
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
  const msgChatId = msg.chat.id;
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
  
  // Si l'utilisateur n'est pas dans une conversation, afficher un message d'aide
  await bot.sendMessage(
    msg.chat.id,
    "Désolé, je ne comprends pas cette commande. Utilisez /help pour voir la liste des commandes disponibles."
  );
}

/**
 * Handles natural language understanding with OpenAI
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} msg - Telegram message object
 */
async function handleNaturalLanguage(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text.trim();
  
  // D'abord, essayons des détections rapides pour éviter d'appeler OpenAI pour des requêtes simples
  
  // Vérifier si c'est une demande de solde avec des mots-clés simples
  if (isBalanceCheck(text)) {
    // Simuler l'appel à la commande balance
    await handleBalance(bot, msg);
    return;
  }
  
  // Vérifier si c'est une demande d'historique avec des mots-clés simples
  if (isHistoryCheck(text)) {
    // Simuler l'appel à la commande history
    await handleHistory(bot, msg);
    return;
  }
  
  // Vérifier si c'est une demande simple de création de token
  if (isCreateTokenRequest(text)) {
    // Simuler l'appel à la commande mint sans arguments
    await handleMint(bot, { ...msg, text: '/mint' });
    return;
  }
  
  // Pour les autres requêtes, utiliser OpenAI pour comprendre l'intention
  await bot.sendMessage(chatId, "Traitement de votre demande...");
  
  // Analyser l'intention avec OpenAI
  const intentResult = await analyzeIntent(userId, text);
  
  if (!intentResult.success) {
    await bot.sendMessage(
      chatId,
      `Désolé, je n'ai pas pu comprendre votre demande. ${intentResult.error || "Veuillez réessayer ou utiliser les commandes /help."}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Gérer l'intention détectée
  switch (intentResult.action) {
    case 'check_balance':
      await handleBalance(bot, msg);
      break;
      
    case 'transfer_hbar':
      // Si les paramètres sont complets, initialiser directement le transfert
      if (intentResult.params.recipientId && intentResult.params.amount) {
        const toAccountId = intentResult.params.recipientId;
        const amount = intentResult.params.amount;
        
        await bot.sendMessage(chatId, `Envoi de ${amount} HBAR à ${toAccountId} en cours...`);
        
        const result = await sendHbar(userId, toAccountId, amount);
        
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
      } else {
        // Sinon, démarrer la conversation structurée normalement
        await handleSend(bot, msg);
      }
      break;
      
    case 'create_token':
      // Pour tout message de création de token, démarrer le processus interactif
      // (sauf si tous les paramètres sont déjà fournis)
      if (intentResult.params.name && intentResult.params.symbol && intentResult.params.initialSupply) {
        // Si tous les paramètres sont complets, créer directement le token
        const tokenInfo = {
          name: intentResult.params.name,
          symbol: intentResult.params.symbol,
          initialSupply: intentResult.params.initialSupply
        };
        
        await bot.sendMessage(chatId, 'Création de votre token en cours... Cela peut prendre un moment.');
        
        const result = await mintToken(userId, tokenInfo);
        
        if (result.success) {
          const message = `
✅ ${result.message}

*Informations du token :*
Token ID: \`${result.tokenId}\`
Nom: ${result.tokenName}
Symbole: ${result.tokenSymbol}
Offre initiale: ${result.initialSupply || 1000}

[Voir dans l'explorateur](${result.explorerUrl})

Utilisez /balance pour voir votre nouveau token dans votre portefeuille.
`;
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(chatId, `❌ ${result.message}`);
        }
      } else {
        // Sinon, démarrer la conversation structurée pour la création de token
        // Simuler une commande /mint sans arguments
        await handleMint(bot, { ...msg, text: '/mint' });
      }
      break;
      
    case 'get_history':
      const limit = intentResult.params.limit || 5;
      await handleHistory(bot, { ...msg, text: `/history ${limit}` });
      break;
      
    case 'create_topic':
      if (intentResult.params.topicName) {
        await bot.sendMessage(chatId, 'Création du topic HCS en cours...');
        
        const result = await createTopic(
          userId, 
          intentResult.params.topicName, 
          intentResult.params.submitKey || false
        );
        
        if (result.success) {
          const message = `
✅ Topic créé avec succès

*Informations du topic :*
Topic ID: \`${result.topicId}\`
Mémo: ${result.memo || intentResult.params.topicName}

[Voir dans l'explorateur](${result.explorerUrl})
`;
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(chatId, `❌ ${result.message}`);
        }
      } else {
        await bot.sendMessage(
          chatId,
          'Pour créer un topic, veuillez fournir un nom. Exemple: "Créer un topic nommé MonTopic"'
        );
      }
      break;
      
    case 'submit_message':
      if (intentResult.params.topicId && intentResult.params.message) {
        await bot.sendMessage(chatId, 'Envoi du message au topic HCS en cours...');
        
        const result = await submitTopicMessage(
          userId, 
          intentResult.params.topicId, 
          intentResult.params.message
        );
        
        if (result.success) {
          const message = `
✅ Message envoyé avec succès

*Détails :*
Topic ID: \`${result.topicId}\`
Message: ${result.message.substring(0, 50)}${result.message.length > 50 ? '...' : ''}
Sequence: ${result.sequence}

[Voir dans l'explorateur](${result.explorerUrl})
`;
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(chatId, `❌ ${result.message}`);
        }
      } else {
        await bot.sendMessage(
          chatId,
          'Pour envoyer un message à un topic, veuillez fournir un ID de topic et un message. Exemple: "Envoyer un message \'Bonjour\' au topic 0.0.12345"'
        );
      }
      break;
      
    case 'get_topic_messages':
      if (intentResult.params.topicId) {
        await bot.sendMessage(chatId, 'Récupération des messages du topic HCS en cours...');
        
        const result = await getTopicMessages(
          userId, 
          intentResult.params.topicId
        );
        
        if (result.success && result.messages && result.messages.length > 0) {
          let message = `📨 *Messages du Topic*\n\nTopic ID: \`${result.topicId}\`\n\n`;
          
          result.messages.forEach((msg, index) => {
            message += `*${index + 1}. Message*\n`;
            message += `Date: ${new Date(msg.consensusTimestamp).toLocaleString()}\n`;
            message += `Contenu: ${msg.message}\n`;
            message += `Séquence: ${msg.sequenceNumber}\n\n`;
          });
          
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else if (result.success && (!result.messages || result.messages.length === 0)) {
          await bot.sendMessage(
            chatId,
            `Aucun message trouvé pour le topic ${result.topicId}`
          );
        } else {
          await bot.sendMessage(chatId, `❌ ${result.message}`);
        }
      } else {
        await bot.sendMessage(
          chatId,
          'Pour voir les messages d\'un topic, veuillez fournir un ID de topic. Exemple: "Voir les messages du topic 0.0.12345"'
        );
      }
      break;
      
    case 'transfer_token':
      if (intentResult.params.recipientId && intentResult.params.tokenId && intentResult.params.amount) {
        await bot.sendMessage(
          chatId, 
          `Envoi de ${intentResult.params.amount} tokens (${intentResult.params.tokenId}) à ${intentResult.params.recipientId} en cours...`
        );
        
        const result = await sendToken(
          userId, 
          intentResult.params.recipientId,
          intentResult.params.tokenId,
          intentResult.params.amount
        );
        
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
      } else {
        await bot.sendMessage(
          chatId,
          'Pour envoyer des tokens, veuillez fournir un ID de compte destinataire, un ID de token et un montant. Exemple: "Envoyer 100 tokens 0.0.12345 à 0.0.67890"'
        );
      }
      break;
      
    case 'unknown':
    default:
      await bot.sendMessage(
        chatId,
        "Je ne suis pas sûr de comprendre votre demande. Essayez d'être plus précis ou utilisez les commandes avec /help pour voir les options disponibles."
      );
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
  
  // Handler pour les messages normaux
  bot.on('message', msg => {
    // Ignorer les commandes (qui commencent par '/')
    if (msg.text && !msg.text.startsWith('/')) {
      // Vérifier si nous sommes au milieu d'une conversation structurée
      const userId = msg.from.id.toString();
      const userInfo = userState.get(userId);
      
      if (userInfo) {
        // Vérifier si nous sommes dans une conversation d'envoi HBAR
        if (userInfo.state && [SEND_STATES.WAITING_FOR_ADDRESS, SEND_STATES.WAITING_FOR_AMOUNT].includes(userInfo.state)) {
          // Si l'utilisateur est dans une conversation d'envoi, continuer celle-ci
          handleSendConversation(bot, msg);
          return;
        }
        
        // Vérifier si nous sommes dans une conversation de création de token
        if (userInfo.tokenInfo && [MINT_STATES.WAITING_FOR_TYPE, MINT_STATES.WAITING_FOR_NAME, 
                                   MINT_STATES.WAITING_FOR_SYMBOL, MINT_STATES.WAITING_FOR_SUPPLY].includes(userInfo.state)) {
          // Si l'utilisateur est dans une conversation de création de token, continuer celle-ci
          handleMintConversation(bot, msg);
          return;
        }
      }
      
      // Si l'utilisateur n'est pas dans une conversation, utiliser OpenAI pour comprendre l'intention
      handleNaturalLanguage(bot, msg);
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
