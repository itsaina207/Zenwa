/**
 * Official Hedera Agent Kit Adapter
 * 
 * Ce fichier connecte le Hedera Agent Kit officiel à notre application.
 * Il s'agit d'une couche d'adaptation qui permet d'utiliser le kit officiel
 * avec notre code existant tout en gérant les différences d'API et de format de données.
 */

// Importations depuis le SDK Hedera
const { Client, AccountId, TokenId, TopicId } = require('@hashgraph/sdk');

// Configuration et utilitaires
const config = require('../config');
const { getExplorerUrls } = require('../utils/explorer');

// Variable pour stocker l'instance du kit
let kitInstance = null;

/**
 * Importer dynamiquement le module Hedera Agent Kit (ESM)
 * Note: Cette approche ne fonctionne pas actuellement, car nous sommes en environnement CommonJS
 */
// Nous n'utilisons pas cette fonction car elle ne fonctionne pas dans CommonJS
// Nous allons plutôt utiliser notre implémentation existante

/**
 * Initialiser le Hedera Agent Kit (en utilisant notre propre implémentation)
 * @returns {Object} Instance du Hedera Agent Kit
 */
async function initializeOfficialKit() {
  if (kitInstance) {
    return kitInstance;
  }

  try {
    // Récupérer les informations d'identification
    const accountId = config.HEDERA_AI_KIT_ACCOUNT_ID;
    const privateKey = config.HEDERA_AI_KIT_PRIVATE_KEY;
    const network = config.HEDERA_NETWORK || 'testnet';

    if (!accountId || !privateKey) {
      throw new Error("Les informations d'identification (accountId ou privateKey) sont manquantes");
    }

    // Utiliser notre implémentation existante de KitManager
    const KitManager = require('./kit-manager');
    kitInstance = new KitManager(accountId, privateKey, network);
    
    console.log('Kit Hedera Agent initialisé avec succès (via KitManager)');
    return kitInstance;
  } catch (error) {
    console.error(`Échec de l'initialisation du Hedera Agent Kit: ${error.message}`);
    throw error;
  }
}

/**
 * Vérifier le solde HBAR d'un compte
 * @param {string} accountId - ID du compte (peut être un ID Hedera ou un ID utilisateur)
 * @returns {Promise<Object>} Informations sur le solde
 */
async function getHbarBalance(accountId) {
  try {
    const kit = await initializeOfficialKit();
    
    // Si l'entrée est un userId, nous devons d'abord le convertir en accountId
    let hederaAccountId = accountId;
    if (!accountId.includes('.')) {
      // C'est probablement un userId, il faut le convertir
      const { getWalletByUserId } = require('../storage/userWallets');
      const wallet = await getWalletByUserId(accountId);
      if (!wallet) {
        return {
          success: false,
          message: 'Portefeuille introuvable pour cet utilisateur'
        };
      }
      hederaAccountId = wallet.accountId;
    }
    
    // Obtenir le solde HBAR
    const hbarBalanceResult = await kit.getHbarBalance(hederaAccountId);
    // Le résultat peut être un objet avec une propriété balance
    let hbarBalance = '0';
    if (typeof hbarBalanceResult === 'object') {
      hbarBalance = hbarBalanceResult.balance || hbarBalanceResult.amount || '0';
    } else if (typeof hbarBalanceResult === 'string') {
      // Si c'est déjà une chaîne, on la prend telle quelle
      hbarBalance = hbarBalanceResult;
    } else if (typeof hbarBalanceResult === 'number') {
      // Si c'est un nombre, on le convertit en chaîne
      hbarBalance = hbarBalanceResult.toString();
    }
    
    // On vérifie si le solde contient déjà l'unité "tℏ"
    const formattedBalance = hbarBalance.includes('tℏ') 
      ? hbarBalance 
      : `${hbarBalance} tℏ`;
    
    // Pour les tokens, nous n'utilisons pas getAllTokensBalances car elle n'existe pas dans notre KitManager
    
    return {
      success: true,
      balance: formattedBalance,
      tokens: {}, // Pas disponible pour l'instant
      accountId: hederaAccountId
    };
  } catch (error) {
    console.error(`Erreur dans getHbarBalance: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération du solde: ${error.message}`
    };
  }
}

/**
 * Transférer des HBAR
 * @param {string} fromUserId - ID de l'utilisateur expéditeur
 * @param {string} toAccountId - ID du compte destinataire
 * @param {string|number} amount - Montant à envoyer
 * @returns {Promise<Object>} Résultat de la transaction
 */
async function transferHbar(fromUserId, toAccountId, amount) {
  try {
    const kit = await initializeOfficialKit();
    
    // Vérifier d'abord le solde disponible
    const balanceResult = await getHbarBalance(fromUserId);
    if (!balanceResult.success) {
      return balanceResult;
    }
    
    // Extraire la valeur numérique du solde
    const balanceString = balanceResult.balance;
    const currentBalance = parseFloat(balanceString.split(' ')[0]);
    
    // Vérifier si le solde est suffisant
    const amountToSend = parseFloat(amount);
    if (currentBalance < amountToSend) {
      return {
        success: false,
        message: `Solde insuffisant. Vous avez ${balanceString} mais vous essayez d'envoyer ${amount} HBAR.`
      };
    }
    
    // Effectuer le transfert
    const result = await kit.transferHbar(toAccountId, amount.toString());
    
    // Si custodial (avec clé privée), nous avons un txHash
    if (result.txHash) {
      const txId = result.txHash;
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      
      return {
        success: true,
        message: `Transfert de ${amount} HBAR vers ${toAccountId} réussi`,
        transactionId: txId,
        explorerUrl: explorerUrls.hashScan,
        explorerUrls
      };
    }
    
    // Si non-custodial, nous avons un txBytes pour signature externe
    return {
      success: true,
      message: 'Transaction préparée, signature requise',
      txBytes: result.txBytes
    };
  } catch (error) {
    console.error(`Erreur dans transferHbar: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors du transfert de HBAR: ${error.message}`
    };
  }
}

/**
 * Créer un token fongible
 * @param {string} userId - ID de l'utilisateur créateur
 * @param {Object} tokenInfo - Informations sur le token
 * @returns {Promise<Object>} Résultat de la création
 */
async function createFungibleToken(userId, tokenInfo) {
  try {
    const kit = await initializeOfficialKit();
    
    // Préparer les options de création de token
    const options = {
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals || 0,
      initialSupply: tokenInfo.initialSupply || 1000,
      maxSupply: tokenInfo.maxSupply,
      memo: tokenInfo.memo || `Token created by Hedera Agent via Telegram Bot`
    };
    
    // Créer le token
    const result = await kit.createFT(options);
    
    // Si custodial (avec clé privée), nous avons un résultat avec tokenId
    if (result.tokenId) {
      const tokenId = result.tokenId.toString();
      const txId = result.txHash;
      const explorerUrls = getExplorerUrls(tokenId, 'token');
      const txExplorerUrls = getExplorerUrls(txId, 'transaction');
      
      return {
        success: true,
        message: `Token créé avec succès: ${options.name} (${options.symbol})`,
        tokenId,
        tokenName: options.name,
        tokenSymbol: options.symbol,
        initialSupply: options.initialSupply,
        transactionId: txId,
        explorerUrl: txExplorerUrls.hashScan,
        explorerUrls
      };
    }
    
    // Si non-custodial, nous avons un txBytes pour signature externe
    return {
      success: true,
      message: 'Transaction de création de token préparée, signature requise',
      txBytes: result.txBytes
    };
  } catch (error) {
    console.error(`Erreur dans createFungibleToken: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la création du token: ${error.message}`
    };
  }
}

/**
 * Transférer un token
 * @param {string} fromUserId - ID de l'utilisateur expéditeur
 * @param {string} toAccountId - ID du compte destinataire
 * @param {string} tokenId - ID du token à transférer
 * @param {number} amount - Montant à transférer
 * @returns {Promise<Object>} Résultat de la transaction
 */
async function transferToken(fromUserId, toAccountId, tokenId, amount) {
  try {
    const kit = await initializeOfficialKit();
    
    // Obtenir l'accountId à partir du userId
    const { getWalletByUserId } = require('../storage/userWallets');
    const wallet = await getWalletByUserId(fromUserId);
    if (!wallet) {
      return {
        success: false,
        message: 'Portefeuille introuvable pour cet utilisateur'
      };
    }
    
    // Convertir l'ID du token en objet TokenId
    let tokenIdObj;
    try {
      tokenIdObj = TokenId.fromString(tokenId);
    } catch (error) {
      return {
        success: false,
        message: `ID de token invalide: ${tokenId}`
      };
    }
    
    // Effectuer le transfert
    const result = await kit.transferToken(tokenIdObj, toAccountId, amount);
    
    // Si custodial (avec clé privée), nous avons un txHash
    if (result.txHash) {
      const txId = result.txHash;
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      
      return {
        success: true,
        message: `Transfert de ${amount} unités du token ${tokenId} vers ${toAccountId} réussi`,
        transactionId: txId,
        explorerUrl: explorerUrls.hashScan,
        explorerUrls
      };
    }
    
    // Si non-custodial, nous avons un txBytes pour signature externe
    return {
      success: true,
      message: 'Transaction préparée, signature requise',
      txBytes: result.txBytes
    };
  } catch (error) {
    console.error(`Erreur dans transferToken: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors du transfert de token: ${error.message}`
    };
  }
}

/**
 * Récupérer l'historique des transactions d'un compte
 * @param {string} userId - ID de l'utilisateur
 * @param {number} limit - Nombre maximum de transactions à retourner
 * @returns {Promise<Object>} Historique des transactions
 */
async function getTransactionHistory(userId, limit = 10) {
  try {
    // Le kit officiel n'a pas de fonction directe pour l'historique des transactions
    // Nous devons utiliser l'API du mirror node

    // Obtenir l'accountId à partir du userId
    const { getWalletByUserId } = require('../storage/userWallets');
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return {
        success: false,
        message: 'Portefeuille introuvable pour cet utilisateur'
      };
    }

    const accountId = wallet.accountId;
    const kit = await initializeOfficialKit();
    const network = kit.network;
    
    // Construire l'URL du mirror node
    const { createBaseMirrorNodeApiUrl } = require('../utils/hedera-api');
    const baseUrl = createBaseMirrorNodeApiUrl(network);
    const url = `${baseUrl}/api/v1/transactions?account.id=${accountId}&limit=${limit}&order=desc`;
    
    // Effectuer la requête HTTP
    const axios = require('axios');
    const response = await axios.get(url);
    
    if (response.status !== 200) {
      throw new Error(`Erreur lors de la récupération de l'historique: ${response.statusText}`);
    }
    
    // Transformer les données en format attendu
    const transactions = response.data.transactions.map(tx => {
      const timestamp = new Date(tx.consensus_timestamp * 1000).toISOString();
      const txId = `${tx.transaction_id}`;
      const explorerUrl = getExplorerUrls(txId, 'transaction').hashScan;
      
      // Déterminer le type de transaction
      let type = 'UNKNOWN';
      if (tx.name && tx.name.includes('TOKENCREATION')) {
        type = 'TOKENCREATION';
      } else if (tx.name && tx.name.includes('CRYPTOTRANSFER')) {
        type = 'CRYPTOTRANSFER';
      } else if (tx.name) {
        type = tx.name.replace('CRYPTO', '').replace('HCS', '').replace('TOKEN', '');
      }
      
      return {
        id: txId,
        timestamp,
        type,
        result: tx.result === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        fee: tx.charged_tx_fee / 100000000,
        explorerUrl
      };
    });
    
    return {
      success: true,
      accountId,
      transactions
    };
  } catch (error) {
    console.error(`Erreur dans getTransactionHistory: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération de l'historique: ${error.message}`
    };
  }
}

/**
 * Créer un topic HCS (Hedera Consensus Service)
 * @param {string} userId - ID de l'utilisateur créateur
 * @param {string} topicMemo - Description du topic
 * @param {boolean} isSubmitKey - Si une clé de soumission est nécessaire
 * @returns {Promise<Object>} Résultat de la création
 */
async function createTopic(userId, topicMemo, isSubmitKey = false) {
  try {
    const kit = await initializeOfficialKit();
    
    // Créer le topic
    const result = await kit.createTopic(topicMemo, isSubmitKey);
    
    // Si custodial (avec clé privée), nous avons un résultat avec topicId
    if (result.topicId) {
      const topicId = result.topicId.toString();
      const txId = result.txHash;
      const explorerUrls = getExplorerUrls(topicId, 'topic');
      
      return {
        success: true,
        message: `Topic créé avec succès: ${topicMemo}`,
        topicId,
        topicMemo,
        isSubmitKey,
        transactionId: txId,
        explorerUrl: explorerUrls.hashScan,
        explorerUrls
      };
    }
    
    // Si non-custodial, nous avons un txBytes pour signature externe
    return {
      success: true,
      message: 'Transaction de création de topic préparée, signature requise',
      txBytes: result.txBytes
    };
  } catch (error) {
    console.error(`Erreur dans createTopic: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la création du topic: ${error.message}`
    };
  }
}

/**
 * Soumettre un message à un topic HCS
 * @param {string} userId - ID de l'utilisateur expéditeur
 * @param {string} topicId - ID du topic
 * @param {string} message - Contenu du message
 * @returns {Promise<Object>} Résultat de la soumission
 */
async function submitTopicMessage(userId, topicId, message) {
  try {
    const kit = await initializeOfficialKit();
    
    // Convertir l'ID du topic en objet TopicId
    let topicIdObj;
    try {
      topicIdObj = TopicId.fromString(topicId);
    } catch (error) {
      return {
        success: false,
        message: `ID de topic invalide: ${topicId}`
      };
    }
    
    // Soumettre le message
    const result = await kit.submitTopicMessage(topicIdObj, message);
    
    // Si custodial (avec clé privée), nous avons un txHash
    if (result.txHash) {
      const txId = result.txHash;
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      
      return {
        success: true,
        message: `Message soumis avec succès au topic ${topicId}`,
        topicId,
        content: message,
        transactionId: txId,
        explorerUrl: explorerUrls.hashScan,
        explorerUrls
      };
    }
    
    // Si non-custodial, nous avons un txBytes pour signature externe
    return {
      success: true,
      message: 'Transaction de soumission de message préparée, signature requise',
      txBytes: result.txBytes
    };
  } catch (error) {
    console.error(`Erreur dans submitTopicMessage: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la soumission du message: ${error.message}`
    };
  }
}

/**
 * Récupérer les messages d'un topic HCS
 * @param {string} topicId - ID du topic
 * @param {number} limit - Nombre maximum de messages à retourner
 * @returns {Promise<Object>} Messages du topic
 */
async function getTopicMessages(topicId, limit = 10) {
  try {
    const kit = await initializeOfficialKit();
    
    // Convertir l'ID du topic en objet TopicId si nécessaire
    let topicIdStr = topicId;
    if (typeof topicId !== 'string') {
      topicIdStr = topicId.toString();
    }
    
    // Récupérer les messages
    const messages = await kit.getTopicMessages(topicIdStr, kit.network);
    
    // Limiter le nombre de messages
    const limitedMessages = messages.slice(0, limit);
    
    return {
      success: true,
      topicId: topicIdStr,
      messages: limitedMessages,
      total: messages.length
    };
  } catch (error) {
    console.error(`Erreur dans getTopicMessages: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération des messages: ${error.message}`
    };
  }
}

/**
 * Récupérer les informations sur un topic HCS
 * @param {string} topicId - ID du topic
 * @returns {Promise<Object>} Informations sur le topic
 */
async function getTopicInfo(topicId) {
  try {
    const kit = await initializeOfficialKit();
    
    // Convertir l'ID du topic en objet TopicId si nécessaire
    let topicIdStr = topicId;
    if (typeof topicId !== 'string') {
      topicIdStr = topicId.toString();
    }
    
    // Récupérer les informations
    const info = await kit.getTopicInfo(topicIdStr, kit.network);
    
    return {
      success: true,
      topicId: topicIdStr,
      info
    };
  } catch (error) {
    console.error(`Erreur dans getTopicInfo: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération des informations: ${error.message}`
    };
  }
}

/**
 * Récupérer les détails d'un token
 * @param {string} tokenId - ID du token
 * @returns {Promise<Object>} Détails du token
 */
async function getTokenDetails(tokenId) {
  try {
    const kit = await initializeOfficialKit();
    
    // Convertir l'ID du token en string si nécessaire
    let tokenIdStr = tokenId;
    if (typeof tokenId !== 'string') {
      tokenIdStr = tokenId.toString();
    }
    
    // Récupérer les détails
    const details = await kit.getHtsTokenDetails(tokenIdStr, kit.network);
    
    return {
      success: true,
      tokenId: tokenIdStr,
      details
    };
  } catch (error) {
    console.error(`Erreur dans getTokenDetails: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération des détails du token: ${error.message}`
    };
  }
}

/**
 * Récupérer les détenteurs d'un token
 * @param {string} tokenId - ID du token
 * @param {number} threshold - Seuil minimum de token pour être considéré comme détenteur
 * @returns {Promise<Object>} Liste des détenteurs du token
 */
async function getTokenHolders(tokenId, threshold = 1) {
  try {
    const kit = await initializeOfficialKit();
    
    // Convertir l'ID du token en string si nécessaire
    let tokenIdStr = tokenId;
    if (typeof tokenId !== 'string') {
      tokenIdStr = tokenId.toString();
    }
    
    // Récupérer les détenteurs
    const holders = await kit.getTokenHolders(tokenIdStr, kit.network, threshold);
    
    return {
      success: true,
      tokenId: tokenIdStr,
      holders
    };
  } catch (error) {
    console.error(`Erreur dans getTokenHolders: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération des détenteurs du token: ${error.message}`
    };
  }
}

// Exporter toutes les fonctions
module.exports = {
  initializeOfficialKit,
  getHbarBalance,
  transferHbar,
  createFungibleToken,
  transferToken,
  getTransactionHistory,
  createTopic,
  submitTopicMessage,
  getTopicMessages,
  getTopicInfo,
  getTokenDetails,
  getTokenHolders
};