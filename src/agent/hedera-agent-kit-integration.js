/**
 * Intégration du Hedera Agent Kit
 * Ce module gère l'intégration entre notre système et le Hedera Agent Kit
 */

// Importation des dépendances
const { createECDH } = require('crypto');
const { AccountId, PrivateKey, Client, TokenId, TopicId } = require('@hashgraph/sdk');
const config = require('../config');
const { getWalletByUserId } = require('../storage/userWallets');
const { storeTokenInfo } = require('../hedera/tokens');

// Fonction pour initialiser le Hedera Agent Kit
let agentKit = null;

/**
 * Récupère ou initialise le Hedera Agent Kit
 * @returns {Promise<Object>} Instance du kit ou objet vide en cas d'échec
 */
async function getHederaAgentKit() {
  if (agentKit) return agentKit;
  
  try {
    // Récupération des identifiants de l'opérateur
    const accountId = config.HEDERA_AI_KIT_ACCOUNT_ID;
    const privateKey = config.HEDERA_AI_KIT_PRIVATE_KEY;
    const network = config.HEDERA_NETWORK || 'testnet';
    
    if (!accountId || !privateKey) {
      throw new Error('Les identifiants de l\'opérateur sont manquants');
    }
    
    // Utiliser notre implémentation de secours KitManager au lieu d'essayer d'importer hedera-agent-kit
    // qui pose des problèmes de compatibilité ESM/CommonJS
    const KitManager = require('./kit-manager');
    const kit = new KitManager(accountId, privateKey, network);
    agentKit = kit;
    console.log('✅ Hedera Agent Kit initialisé avec succès (utilisant l\'implémentation interne)');
    return kit;
  } catch (error) {
    console.error(`❌ Échec de l'initialisation du Hedera Agent Kit: ${error.message}`);
    console.error(error.stack);
    return {};
  }
}

/**
 * Vérifier le solde HBAR d'un compte
 * @param {string} userId - ID Telegram de l'utilisateur
 * @returns {Promise<Object>} Informations sur le solde
 */
async function checkHbarBalance(userId) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    const kit = await getHederaAgentKit();
    
    if (!kit.getHbarBalance) {
      // Fallback vers notre implémentation existante
      const { getBalance } = require('../hedera/account');
      return await getBalance(userId);
    }
    
    const result = await kit.getHbarBalance(wallet.account_id);
    return {
      success: true,
      balance: { hbars: result.balance },
      accountId: wallet.account_id
    };
  } catch (error) {
    console.error(`Erreur lors de la vérification du solde HBAR: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Vérifier les soldes de tokens d'un compte
 * @param {string} userId - ID Telegram de l'utilisateur
 * @returns {Promise<Object>} Informations sur les tokens
 */
async function checkTokenBalances(userId) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    const kit = await getHederaAgentKit();
    
    if (!kit.getAllTokensBalances) {
      // Fallback vers notre implémentation existante
      const { getBalance } = require('../hedera/account');
      return await getBalance(userId);
    }
    
    const result = await kit.getAllTokensBalances('testnet', wallet.account_id);
    return {
      success: true,
      tokens: result,
      accountId: wallet.account_id
    };
  } catch (error) {
    console.error(`Erreur lors de la vérification des soldes de tokens: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Envoyer des HBAR
 * @param {string} userId - ID Telegram de l'expéditeur
 * @param {string} recipientId - ID du compte destinataire
 * @param {string|number} amount - Montant à envoyer
 * @returns {Promise<Object>} Résultat de la transaction
 */
async function sendHbar(userId, recipientId, amount) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    const kit = await getHederaAgentKit();
    
    if (!kit.transferHbar) {
      // Fallback vers notre implémentation existante
      const { sendHbar } = require('../hedera/account');
      return await sendHbar(userId, recipientId, amount);
    }
    
    const result = await kit.transferHbar(recipientId, amount.toString());
    return {
      success: result.success,
      transactionId: result.transactionId,
      message: result.success ? 
        `Transaction réussie ! ${amount} HBAR envoyés à ${recipientId}` : 
        (result.error || 'Erreur lors du transfert')
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de HBAR: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Créer un token fongible
 * @param {string} userId - ID Telegram du créateur
 * @param {Object} tokenInfo - Informations sur le token
 * @returns {Promise<Object>} Résultat de la création
 */
async function createFungibleToken(userId, tokenInfo) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    const kit = await getHederaAgentKit();
    
    if (!kit.createFT) {
      // Fallback vers notre implémentation existante
      const { mintToken } = require('../hedera/tokens');
      return await mintToken(userId, tokenInfo);
    }
    
    // Extraire les valeurs avec des valeurs par défaut
    let initialSupply = tokenInfo.initialSupply || 1000;
    
    // Appliquer la limite maximale pour l'offre initiale
    const MAX_SUPPLY = 100000000; // 100 millions
    if (initialSupply > MAX_SUPPLY) {
      console.warn(`Supply limit exceeded (${initialSupply}), capping to ${MAX_SUPPLY}`);
      initialSupply = MAX_SUPPLY;
    }
    
    // Déterminer la maxSupply (si non spécifiée, utiliser la même que initialSupply)
    let maxSupply = tokenInfo.maxSupply || 0;
    if (maxSupply > MAX_SUPPLY) {
      console.warn(`Max supply limit exceeded (${maxSupply}), capping to ${MAX_SUPPLY}`);
      maxSupply = MAX_SUPPLY;
    }
    
    const options = {
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals || 0,
      initialSupply: initialSupply,
      maxSupply: maxSupply,
      supplyType: tokenInfo.supplyType || "INFINITE",
      memo: `Token créé par l'utilisateur ${userId}`
    };
    
    const result = await kit.createFT(options);
    
    if (result.success && result.tokenId) {
      // Stocker les informations du token dans notre base de données
      await storeTokenInfo(userId, result.tokenId, tokenInfo.name, tokenInfo.symbol);
    }
    
    return {
      success: result.success,
      tokenId: result.tokenId,
      message: result.success ? 
        `Token créé avec succès ! Nom: ${tokenInfo.name}, Symbole: ${tokenInfo.symbol}, ID: ${result.tokenId}` : 
        (result.error || 'Erreur lors de la création du token')
    };
  } catch (error) {
    console.error(`Erreur lors de la création du token: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Transférer un token
 * @param {string} userId - ID Telegram de l'expéditeur
 * @param {string} recipientId - ID du compte destinataire
 * @param {string} tokenId - ID du token à transférer
 * @param {number} amount - Montant à transférer
 * @returns {Promise<Object>} Résultat de la transaction
 */
async function transferToken(userId, recipientId, tokenId, amount) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    const kit = await getHederaAgentKit();
    
    if (!kit.transferToken) {
      // Fallback vers notre implémentation existante
      const { sendToken } = require('../hedera/tokens');
      return await sendToken(userId, recipientId, tokenId, amount);
    }
    
    // Vérifier si tokenId est un objet TokenId ou une chaîne
    const tokenIdToUse = typeof tokenId === 'string' ? TokenId.fromString(tokenId) : tokenId;
    
    const result = await kit.transferToken(tokenIdToUse, recipientId, amount);
    return {
      success: result.success,
      transactionId: result.transactionId,
      message: result.success ? 
        `Transaction réussie ! ${amount} tokens (${tokenId}) envoyés à ${recipientId}` : 
        (result.error || 'Erreur lors du transfert de tokens')
    };
  } catch (error) {
    console.error(`Erreur lors du transfert de tokens: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Obtenir l'historique des transactions
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {number} limit - Nombre maximum de transactions à retourner
 * @returns {Promise<Object>} Historique des transactions
 */
async function getTransactionHistory(userId, limit = 10) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }
    
    // Le Hedera Agent Kit n'a pas de fonction directe pour l'historique des transactions
    // Nous utilisons donc notre implémentation existante
    const { getTransactionHistory } = require('../hedera/transactions');
    return await getTransactionHistory(userId, limit);
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'historique: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Récupérer les outils du Hedera Agent Kit pour l'intégration LangChain
 * @returns {Promise<Array>} Liste des outils pour LangChain
 */
async function getHederaAgentTools() {
  try {
    // Utiliser notre implémentation de createHederaTools directement
    const KitManager = require('./kit-manager');
    const createHederaTools = KitManager.createHederaTools;
    
    if (createHederaTools) {
      const accountId = config.HEDERA_AI_KIT_ACCOUNT_ID;
      const privateKey = config.HEDERA_AI_KIT_PRIVATE_KEY;
      
      const client = Client.forTestnet();
      
      return createHederaTools({
        hederaClient: client,
        operatorId: accountId,
        operatorKey: privateKey
      });
    }
    
    // Si createHederaTools n'est pas disponible, retourner un tableau vide
    return [];
  } catch (error) {
    console.error(`Erreur lors de la récupération des outils: ${error.message}`);
    return [];
  }
}

module.exports = {
  getHederaAgentKit,
  checkHbarBalance,
  checkTokenBalances,
  sendHbar,
  createFungibleToken,
  transferToken,
  getTransactionHistory,
  getHederaAgentTools
};