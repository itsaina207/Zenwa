/**
 * Module de gestion des airdrops de tokens Hedera
 * Permet la création et la réclamation d'airdrops de tokens
 */

const {
  TokenAirdropTransaction,
  TokenClaimAirdropTransaction,
  TokenId,
  PendingAirdropId
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getAccountInfo } = require('./account');
const { getExplorerUrls } = require('../utils/explorer');
const { getWalletByUserId } = require('../storage/userWallets');

/**
 * Convertit un ID Telegram ou un ID de compte Hedera en ID de compte Hedera
 * @param {string} identifier - ID Telegram ou ID de compte Hedera
 * @returns {Promise<string|null>} ID de compte Hedera ou null si non trouvé
 */
async function resolveToAccountId(identifier) {
  try {
    console.log(`Essai de résolution de l'identifiant: "${identifier}"`);
    // Vérifier si c'est déjà un ID de compte Hedera (format: 0.0.X)
    if (/^\d+\.\d+\.\d+$/.test(identifier)) {
      console.log(`Identifiant reconnu comme un account ID Hedera: ${identifier}`);
      return identifier;
    }
    
    // Si l'identifiant commence par @, le supprimer
    let telegramId = identifier;
    if (telegramId.startsWith('@')) {
      telegramId = telegramId.substring(1);
      console.log(`Identifiant modifié sans @: ${telegramId}`);
    }
    
    // Essayer de trouver le compte associé au nom d'utilisateur ou à l'ID Telegram
    const { query } = require('../storage/db');
    
    // Essayer d'abord par user_id exact (pour les IDs numériques)
    let wallet = await getWalletByUserId(telegramId);
    
    if (!wallet) {
      console.log(`Aucun wallet trouvé pour l'ID exact ${telegramId}, recherche dans la base de données...`);
      
      // Si aucun résultat direct, essayer de faire une recherche plus large dans la base
      // Attention: Cette méthode pourrait potentiellement trouver plusieurs correspondances
      try {
        // Vérifier si nous pouvons trouver un utilisateur dont le nom ressemble à l'identifiant
        const sql = "SELECT * FROM user_wallets WHERE user_id ILIKE $1 LIMIT 1";
        const result = await query(sql, [`%${telegramId}%`]);
        
        if (result && result.rows && result.rows.length > 0) {
          console.log(`Trouvé un wallet par recherche partielle: ${result.rows[0].user_id}`);
          wallet = {
            userId: result.rows[0].user_id,
            accountId: result.rows[0].account_id,
            privateKey: result.rows[0].private_key,
            publicKey: result.rows[0].public_key,
            evmAddress: result.rows[0].evm_address
          };
        }
      } catch (dbError) {
        console.error('Erreur lors de la recherche de wallet par nom:', dbError);
      }
    }
    
    if (wallet) {
      console.log(`Wallet trouvé pour ${telegramId}, account ID: ${wallet.accountId}`);
      return wallet.accountId;
    }
    
    console.log(`Aucun wallet trouvé pour ${telegramId}`);
    return null;
  } catch (error) {
    console.error('Erreur lors de la résolution de l\'ID:', error);
    return null;
  }
}

/**
 * Résout une liste d'identifiants en IDs de compte Hedera
 * @param {string} identifiersList - Liste d'identifiants séparés par des virgules
 * @returns {Promise<Array<{id: string, accountId: string|null}>>} Liste des IDs originaux et des IDs de compte résolus
 */
async function resolveIdentifiersList(identifiersList) {
  // Diviser la chaîne par virgules et supprimer les espaces
  const identifiers = identifiersList.split(',').map(id => id.trim()).filter(id => id.length > 0);
  
  // Résoudre chaque identifiant
  const results = [];
  for (const id of identifiers) {
    const accountId = await resolveToAccountId(id);
    results.push({ id, accountId });
  }
  
  return results;
}

/**
 * Créer un airdrop de tokens pour plusieurs destinataires
 * @param {string} userId - ID Telegram de l'utilisateur qui crée l'airdrop
 * @param {string} tokenId - ID du token à distribuer
 * @param {Array<{accountId: string, amount: number}>} recipients - Liste des destinataires avec leurs montants
 * @returns {Promise<Object>} Résultat de l'opération d'airdrop
 */
async function createTokenAirdrop(userId, tokenId, recipients) {
  try {
    // Récupérer les informations du compte créateur
    const accountInfo = await getAccountInfo(userId);
    if (!accountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
      };
    }

    const { accountId, privateKey } = accountInfo;
    const client = getClient();
    
    // Vérifier que le tokenId est au bon format et créer un objet TokenId
    let tokenIdObj;
    try {
      tokenIdObj = TokenId.fromString(tokenId);
    } catch (error) {
      return {
        success: false,
        message: `Format de Token ID invalide: ${error.message}`
      };
    }
    
    // Créer la transaction d'airdrop
    let txAirdrop = new TokenAirdropTransaction();
    
    // Le compte créateur doit d'abord déduire tous les tokens à distribuer
    const totalAmount = recipients.reduce((sum, recipient) => sum + recipient.amount, 0);
    txAirdrop = txAirdrop.addTokenTransfer(tokenIdObj, accountId, -totalAmount);
    
    // Ajouter chaque destinataire avec son montant
    for (const recipient of recipients) {
      txAirdrop = txAirdrop.addTokenTransfer(tokenIdObj, recipient.accountId, recipient.amount);
    }
    
    // Finaliser et signer la transaction
    const txAirdropFrozen = await txAirdrop.freezeWith(client);
    const signedTx = await txAirdropFrozen.sign(privateKey);
    
    // Soumettre la transaction
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    // Récupérer le pending airdrop ID si disponible
    let pendingAirdropId = null;
    try {
      pendingAirdropId = receipt.pendingAirdropId;
    } catch (error) {
      console.warn('Pas de pendingAirdropId disponible:', error.message);
    }
    
    const txId = txResponse.transactionId.toString();
    
    // Préparer le résultat avec les liens vers les explorateurs
    const result = {
      success: true,
      message: 'Airdrop de tokens créé avec succès',
      transactionId: txId,
      tokenId: tokenId,
      recipientCount: recipients.length,
      totalAmount: totalAmount,
      pendingAirdropId: pendingAirdropId ? pendingAirdropId.toString() : null,
      status: receipt.status.toString()
    };
    
    // Ajouter les liens vers les explorateurs
    try {
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      result.explorerUrl = explorerUrls.hederaExplorer;
      result.hashscanUrl = explorerUrls.hashScan;
    } catch (error) {
      console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Erreur lors de la création de l\'airdrop:', error);
    return {
      success: false,
      message: `Erreur lors de la création de l'airdrop: ${error.message}`
    };
  }
}

/**
 * Vérifier les airdrops disponibles pour un utilisateur
 * @param {string} userId - ID Telegram de l'utilisateur
 * @returns {Promise<Array<Object>>} Liste des airdrops disponibles
 */
async function getAvailableAirdrops(userId) {
  try {
    // Cette fonction est un emplacement pour une future implémentation
    // qui permettrait de récupérer les airdrops disponibles pour un utilisateur
    // à partir de l'API Hedera ou d'une autre source de données.
    
    // Pour l'instant, nous retournons une liste vide car Hedera n'expose pas
    // directement une API pour lister les airdrops disponibles.
    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération des airdrops disponibles:', error);
    return [];
  }
}

/**
 * Réclamer un airdrop de tokens
 * @param {string} userId - ID Telegram de l'utilisateur qui réclame l'airdrop
 * @param {string} pendingAirdropId - ID de l'airdrop en attente
 * @returns {Promise<Object>} Résultat de l'opération de réclamation
 */
async function claimTokenAirdrop(userId, pendingAirdropId) {
  try {
    // Récupérer les informations du compte réclamant
    const accountInfo = await getAccountInfo(userId);
    if (!accountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
      };
    }

    const { accountId, privateKey } = accountInfo;
    const client = getClient();
    
    // Vérifier que le pendingAirdropId est au bon format et créer un objet PendingAirdropId
    let pendingAirdropIdObj;
    try {
      pendingAirdropIdObj = PendingAirdropId.fromString(pendingAirdropId);
    } catch (error) {
      return {
        success: false,
        message: `Format d'Airdrop ID invalide: ${error.message}`
      };
    }
    
    // Créer la transaction de réclamation d'airdrop
    const txClaimAirdrop = await new TokenClaimAirdropTransaction()
      .addPendingAirdropId(pendingAirdropIdObj)
      .freezeWith(client);
      
    // Signer avec la clé privée du réclamant
    const signedTx = await txClaimAirdrop.sign(privateKey);
    
    // Soumettre la transaction
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const txId = txResponse.transactionId.toString();
    
    // Préparer le résultat avec les liens vers les explorateurs
    const result = {
      success: true,
      message: 'Réclamation d\'airdrop réussie',
      transactionId: txId,
      pendingAirdropId: pendingAirdropId,
      accountId: accountId.toString(),
      status: receipt.status.toString()
    };
    
    // Ajouter les liens vers les explorateurs
    try {
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      result.explorerUrl = explorerUrls.hederaExplorer;
      result.hashscanUrl = explorerUrls.hashScan;
    } catch (error) {
      console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Erreur lors de la réclamation de l\'airdrop:', error);
    return {
      success: false,
      message: `Erreur lors de la réclamation de l'airdrop: ${error.message}`
    };
  }
}

module.exports = {
  createTokenAirdrop,
  claimTokenAirdrop,
  resolveToAccountId,
  resolveIdentifiersList,
  getAvailableAirdrops
};