/**
 * Natural Language Processor for Hedera wallet actions
 * Processes natural language commands and converts them to wallet actions
 * Includes Eliza plugin integration for blockchain state queries
 */

const { getWalletByUserId } = require('../storage/userWallets');
const { getBalance, sendHbar } = require('../hedera/account');
const { getTransactionHistory } = require('../hedera/transactions');
const { mintToken, sendToken } = require('../hedera/tokens');
const { createTokenAirdrop, claimTokenAirdrop } = require('../hedera/airdrop');
const { isElizaQuery, processWithEliza } = require('../services/openai-service');

/**
 * Process a natural language command for Hedera wallet actions
 * @param {string} userId - The Telegram user ID
 * @param {string} message - The natural language message from the user
 * @returns {Promise<object>} Result of the processed command
 */
async function processNaturalLanguageCommand(userId, message) {
  // Convert message to lowercase for easier matching
  const text = message.toLowerCase().trim();
  
  try {
    // Check if this is an Eliza blockchain query
    if (isElizaQuery(message)) {
      console.log(`Processing Eliza query: ${message}`);
      return await processWithEliza(userId, message);
    }

    // Check if wallet exists
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return {
        success: false,
        message: "Vous n'avez pas encore de wallet. Veuillez créer un wallet d'abord avec /createwallet.",
        action: null
      };
    }

    // Check for balance request
    if (text.includes('solde') || text.includes('balance') || text.includes('combien') || 
        text.match(/montrer(?:\s+mon)?\s+solde/) || text.match(/voir(?:\s+mon)?\s+solde/)) {
      return await handleBalanceRequest(userId);
    }

    // Check for transaction history request
    if (text.includes('historique') || text.includes('history') || text.includes('transactions') ||
        text.match(/voir(?:\s+mes)?\s+transactions/) || text.match(/montrer(?:\s+mon)?\s+historique/)) {
      return await handleHistoryRequest(userId);
    }

    // Check for send HBAR request
    const sendHbarPattern = /(?:envoyer|envoie|transférer|transfert)\s+(\d+(?:\.\d+)?)\s+(?:hbar|hedera)\s+(?:à|a|vers|to)\s+(\S+)/i;
    const sendMatch = text.match(sendHbarPattern);
    if (sendMatch) {
      const amount = sendMatch[1];
      const recipient = sendMatch[2];
      return await handleSendHbarRequest(userId, recipient, amount);
    }

    // Check for token transfer request
    const sendTokenPattern = /(?:envoyer|envoie|transférer|transfert)\s+(\d+)\s+tokens?\s+(?:de|from)?\s+(\S+)\s+(?:à|a|vers|to)\s+(\S+)/i;
    const tokenMatch = text.match(sendTokenPattern);
    if (tokenMatch) {
      const amount = tokenMatch[1];
      const tokenId = tokenMatch[2];
      const recipient = tokenMatch[3];
      return await handleSendTokenRequest(userId, recipient, tokenId, amount);
    }

    // Check for token creation/minting request
    const mintTokenPattern = /(?:créer|creer|minter|créez|mint)\s+(?:un|new|token)\s+token\s+(?:nommé|nomme|named|appelé|appele)\s+([^\s,]+)\s+(?:avec|with)\s+(?:symbole|symbol)\s+([^\s,]+)/i;
    const mintMatch = text.match(mintTokenPattern);
    if (mintMatch) {
      const name = mintMatch[1];
      const symbol = mintMatch[2];
      return await handleMintTokenRequest(userId, name, symbol);
    }
    
    // Check for viewing available airdrops request
    const viewAirdropsPattern = /(?:voir|show|afficher|montrer|lister|list)\s+(?:mes|les|my|all)\s+(?:airdrops?|tokens?\s+disponibles?|airdrop\s+disponibles?)/i;
    const viewMatch = text.match(viewAirdropsPattern);
    if (viewMatch) {
      return await handleClaimAirdropRequest(userId);
    }
    
    // Check for airdrop claim request
    const claimAirdropPattern = /(?:réclamer|reclamer|claim|claimer)\s+(?:un|my|le|mon|l'|token|l'airdrop|airdrop)\s+(?:airdrop|token)/i;
    const claimAirdropWithIdPattern = /(?:réclamer|reclamer|claim|claimer)\s+(?:un|my|le|mon|l'|token|l'airdrop|airdrop)\s+(?:airdrop|token)\s+(?:avec|with|d'|de|from)\s+(?:id|identifiant)?\s*[:#]?\s*(\S+)/i;
    
    // Pattern with explicit ID
    const claimWithIdMatch = text.match(claimAirdropWithIdPattern);
    if (claimWithIdMatch) {
      const airdropId = claimWithIdMatch[1].trim();
      return await handleClaimAirdropRequest(userId, airdropId);
    }
    
    // Generic claim pattern without ID, will check available airdrops
    const claimMatch = text.match(claimAirdropPattern);
    if (claimMatch) {
      return await handleClaimAirdropRequest(userId);
    }

    // If no pattern matches
    return {
      success: false,
      message: "Je ne comprends pas cette commande. Essayez d'utiliser une commande comme 'voir mon solde', 'envoyer 10 HBAR à 0.0.123456', ou 'créer un token nommé MonToken avec symbole MTK'.",
      action: null
    };

  } catch (error) {
    console.error(`Error processing natural language command: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors du traitement de la commande: ${error.message}`,
      action: null
    };
  }
}

/**
 * Handle a balance request
 * @param {string} userId - Telegram user ID
 * @returns {Promise<object>} Result of the balance request
 */
async function handleBalanceRequest(userId) {
  try {
    const result = await getBalance(userId);
    if (result.success) {
      return {
        success: true,
        message: `Votre solde est de ${result.balance} HBAR`,
        action: 'balance'
      };
    } else {
      return {
        success: false,
        message: result.message || "Erreur lors de la récupération du solde",
        action: 'balance'
      };
    }
  } catch (error) {
    console.error(`Error in balance request: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération du solde: ${error.message}`,
      action: 'balance'
    };
  }
}

/**
 * Handle a transaction history request
 * @param {string} userId - Telegram user ID
 * @returns {Promise<object>} Result of the history request
 */
async function handleHistoryRequest(userId) {
  try {
    const result = await getTransactionHistory(userId);
    if (result.success) {
      if (result.transactions.length === 0) {
        return {
          success: true,
          message: "Vous n'avez pas encore effectué de transactions.",
          action: 'history'
        };
      }
      
      // Format transactions for display
      const formattedTxs = result.transactions.map((tx, index) => 
        `${index + 1}. Type: ${tx.type}, Montant: ${tx.amount}, Date: ${new Date(tx.timestamp).toLocaleString()}`
      ).join('\n');
      
      return {
        success: true,
        message: `Vos transactions récentes:\n${formattedTxs}`,
        action: 'history',
        transactions: result.transactions
      };
    } else {
      return {
        success: false,
        message: result.message || "Erreur lors de la récupération de l'historique",
        action: 'history'
      };
    }
  } catch (error) {
    console.error(`Error in history request: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération de l'historique: ${error.message}`,
      action: 'history'
    };
  }
}

/**
 * Handle a send HBAR request
 * @param {string} userId - Telegram user ID of sender
 * @param {string} recipient - Recipient's account ID
 * @param {string|number} amount - Amount of HBAR to send
 * @returns {Promise<object>} Result of the send request
 */
async function handleSendHbarRequest(userId, recipient, amount) {
  try {
    // Clean up recipient address if needed
    const cleanRecipient = recipient.trim();
    
    // Convert amount to string if it's a number
    const amountStr = amount.toString();
    
    const result = await sendHbar(userId, cleanRecipient, amountStr);
    if (result.success) {
      return {
        success: true,
        message: `Vous avez envoyé ${amountStr} HBAR à ${cleanRecipient} avec succès ! ID de transaction: ${result.transactionId}`,
        action: 'send',
        transactionId: result.transactionId
      };
    } else {
      return {
        success: false,
        message: result.message || `Erreur lors de l'envoi de HBAR`,
        action: 'send'
      };
    }
  } catch (error) {
    console.error(`Error in send HBAR request: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de l'envoi de HBAR: ${error.message}`,
      action: 'send'
    };
  }
}

/**
 * Handle a send token request
 * @param {string} userId - Telegram user ID of sender
 * @param {string} recipient - Recipient's account ID
 * @param {string} tokenId - ID of the token to send
 * @param {string|number} amount - Amount of tokens to send
 * @returns {Promise<object>} Result of the token send request
 */
async function handleSendTokenRequest(userId, recipient, tokenId, amount) {
  try {
    // Clean up recipient and token ID
    const cleanRecipient = recipient.trim();
    const cleanTokenId = tokenId.trim();
    
    // Convert amount to number
    const amountNum = parseInt(amount, 10);
    
    if (isNaN(amountNum)) {
      return {
        success: false,
        message: "Le montant doit être un nombre entier",
        action: 'sendtoken'
      };
    }
    
    const result = await sendToken(userId, cleanRecipient, cleanTokenId, amountNum);
    if (result.success) {
      return {
        success: true,
        message: `Vous avez envoyé ${amountNum} tokens ${cleanTokenId} à ${cleanRecipient} avec succès ! ID de transaction: ${result.transactionId}`,
        action: 'sendtoken',
        transactionId: result.transactionId
      };
    } else {
      return {
        success: false,
        message: result.message || `Erreur lors de l'envoi des tokens`,
        action: 'sendtoken'
      };
    }
  } catch (error) {
    console.error(`Error in send token request: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de l'envoi des tokens: ${error.message}`,
      action: 'sendtoken'
    };
  }
}

/**
 * Handle a mint token request
 * @param {string} userId - Telegram user ID
 * @param {string} name - Token name
 * @param {string} symbol - Token symbol
 * @returns {Promise<object>} Result of the token minting request
 */
async function handleMintTokenRequest(userId, name, symbol) {
  try {
    // Create token info object
    const tokenInfo = {
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      decimals: 0,
      initialSupply: 1000,
      supplyType: "INFINITE"
    };
    
    const result = await mintToken(userId, tokenInfo);
    if (result.success) {
      return {
        success: true,
        message: `Vous avez créé avec succès un nouveau token nommé ${tokenInfo.name} (${tokenInfo.symbol}) ! ID du token: ${result.tokenId}`,
        action: 'mint',
        tokenId: result.tokenId
      };
    } else {
      return {
        success: false,
        message: result.message || "Erreur lors de la création du token",
        action: 'mint'
      };
    }
  } catch (error) {
    console.error(`Error in mint token request: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la création du token: ${error.message}`,
      action: 'mint'
    };
  }
}

/**
 * Handle a claim airdrop request
 * @param {string} userId - Telegram user ID
 * @param {string} [airdropId] - Optional airdrop ID to claim specific airdrop
 * @returns {Promise<object>} Result of the airdrop claim request
 */
async function handleClaimAirdropRequest(userId, airdropId = null) {
  try {
    // Si aucun ID n'est fourni, récupérer les airdrops disponibles et tenter de réclamer le premier
    if (!airdropId) {
      const { getAvailableAirdrops } = require('../storage/airdrops');
      const availableAirdrops = await getAvailableAirdrops(userId);
      
      if (availableAirdrops.length === 0) {
        return {
          success: false,
          message: "Vous n'avez aucun airdrop disponible à réclamer.",
          action: 'claim_airdrop'
        };
      }
      
      // Réclamer le premier airdrop disponible
      airdropId = availableAirdrops[0].id;
      console.log(`Claiming first available airdrop with ID: ${airdropId}`);
    }
    
    // Réclamer l'airdrop avec l'ID fourni ou le premier disponible
    const result = await claimTokenAirdrop(userId, airdropId, true); // true = utiliser l'ID de base de données
    
    if (result.success) {
      return {
        success: true,
        message: `Vous avez réclamé avec succès l'airdrop ! Vous avez reçu ${result.amount} tokens ${result.tokenId}. ID de transaction: ${result.transactionId}`,
        action: 'claim_airdrop',
        transactionId: result.transactionId
      };
    } else {
      return {
        success: false,
        message: result.message || "Erreur lors de la réclamation de l'airdrop",
        action: 'claim_airdrop'
      };
    }
  } catch (error) {
    console.error(`Error in claim airdrop request: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la réclamation de l'airdrop: ${error.message}`,
      action: 'claim_airdrop'
    };
  }
}

module.exports = {
  processNaturalLanguageCommand
};