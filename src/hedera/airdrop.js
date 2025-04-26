/**
 * Module de gestion des airdrops de tokens Hedera
 * Permet la création et la réclamation d'airdrops de tokens
 */

const {
  TokenAirdropTransaction,
  TokenClaimAirdropTransaction,
  TokenId,
  PendingAirdropId,
  PrivateKey
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getAccountInfo } = require('./account');
const { getExplorerUrls } = require('../utils/explorer');
const { getWalletByUserId, getWalletByUsername, getWalletByPhoneNumber } = require('../storage/userWallets');
const { storeAirdrop, getAvailableAirdropsForAccount, markAirdropAsClaimed } = require('../storage/airdrops');

/**
 * Convertit un ID Telegram, un numéro de téléphone ou un ID de compte Hedera en ID de compte Hedera
 * @param {string} identifier - ID Telegram, numéro de téléphone ou ID de compte Hedera
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
    
    // Si l'identifiant commence par @, le supprimer pour certaines recherches
    let telegramId = identifier;
    let originalId = identifier; // Garder l'identifiant original pour la recherche
    if (telegramId.startsWith('@')) {
      telegramId = telegramId.substring(1);
      console.log(`Identifiant modifié sans @: ${telegramId}`);
    }
    
    // 1. Vérifier si c'est un numéro de téléphone (0xx ou +xx)
    if (identifier.match(/^[0+][0-9\s\-\(\)\.]+$/)) {
      console.log(`Tentative de résolution par numéro de téléphone pour: ${identifier}`);
      const wallet = await getWalletByPhoneNumber(identifier);
      
      if (wallet) {
        console.log(`Wallet trouvé par numéro de téléphone: ${wallet.phoneNumber}`);
        return wallet.accountId;
      }
    }
    
    // 2. Essayer de trouver par ID numérique
    let wallet = await getWalletByUserId(telegramId);
    
    // 3. Si ça échoue et c'est potentiellement un nom d'utilisateur, essayer par nom d'utilisateur
    if (!wallet && (telegramId.match(/[a-zA-Z]/) || originalId.match(/[a-zA-Z]/))) {
      console.log(`Tentative de résolution par nom d'utilisateur pour: ${originalId}`);
      wallet = await getWalletByUsername(originalId);
      
      if (wallet) {
        console.log(`Wallet trouvé par nom d'utilisateur: ${wallet.username}`);
        return wallet.accountId;
      }
    }
    
    if (!wallet) {
      console.log(`Aucun wallet trouvé par méthodes directes pour ${telegramId}, tentatives avancées...`);
      
      // 3. Essayer de résoudre via l'API Telegram
      try {
        const telegramBot = require('../telegram/bot').getBot();
        
        try {
          console.log(`Tentative de résolution via l'API Telegram pour: ${telegramId}`);
          const chatInfo = await telegramBot.getChat(`@${telegramId}`);
          
          if (chatInfo && chatInfo.id) {
            console.log(`ID Telegram résolu via l'API: ${chatInfo.id}`);
            
            // Vérifier si cet ID existe dans la base de données
            const resolvedWallet = await getWalletByUserId(chatInfo.id.toString());
            
            if (resolvedWallet) {
              console.log(`Wallet trouvé pour l'ID résolu ${chatInfo.id}`);
              
              // Mise à jour du nom d'utilisateur si absent
              if (!resolvedWallet.username) {
                const { query } = require('../storage/db');
                await query(
                  'UPDATE user_wallets SET username = $1 WHERE user_id = $2',
                  [telegramId, chatInfo.id.toString()]
                );
                console.log(`Nom d'utilisateur ${telegramId} ajouté au wallet ${chatInfo.id}`);
              }
              
              return resolvedWallet.accountId;
            }
          }
        } catch (telegramError) {
          console.log(`Impossible de résoudre via l'API Telegram: ${telegramError.message}`);
        }
        
        // 4. Recherche avancée dans la base de données
        try {
          const { query } = require('../storage/db');
          // Recherche avec LIKE pour trouver des correspondances partielles
          const searchPatterns = [
            telegramId,                  // Nom d'utilisateur sans @
            `%${telegramId}%`,           // Recherche partielle sur le nom d'utilisateur
            originalId,                  // Identifiant original (avec @ si présent)
            `%${originalId}%`            // Recherche partielle sur l'identifiant original
          ];
          
          // Essayer d'abord dans le champ username
          for (const pattern of searchPatterns) {
            console.log(`Essai de recherche avec pattern dans username: ${pattern}`);
            const sql = "SELECT * FROM user_wallets WHERE username ILIKE $1 LIMIT 1";
            const result = await query(sql, [pattern]);
            
            if (result && result.rows && result.rows.length > 0) {
              console.log(`Trouvé un wallet par username avec pattern "${pattern}": ${result.rows[0].username}`);
              wallet = {
                userId: result.rows[0].user_id,
                accountId: result.rows[0].account_id,
                privateKey: result.rows[0].private_key,
                publicKey: result.rows[0].public_key,
                evmAddress: result.rows[0].evm_address,
                username: result.rows[0].username
              };
              break;
            }
          }
          
          // Si toujours pas trouvé, chercher dans user_id
          if (!wallet) {
            for (const pattern of searchPatterns) {
              console.log(`Essai de recherche avec pattern dans user_id: ${pattern}`);
              const sql = "SELECT * FROM user_wallets WHERE user_id::text ILIKE $1 LIMIT 1";
              const result = await query(sql, [pattern]);
              
              if (result && result.rows && result.rows.length > 0) {
                console.log(`Trouvé un wallet par user_id avec pattern "${pattern}": ${result.rows[0].user_id}`);
                wallet = {
                  userId: result.rows[0].user_id,
                  accountId: result.rows[0].account_id,
                  privateKey: result.rows[0].private_key,
                  publicKey: result.rows[0].public_key,
                  evmAddress: result.rows[0].evm_address,
                  username: result.rows[0].username
                };
                break;
              }
            }
          }
        } catch (dbError) {
          console.error('Erreur lors de la recherche avancée de wallet:', dbError);
        }
      } catch (error) {
        console.error('Erreur lors de la résolution avancée:', error);
      }
    }
    
    if (wallet) {
      console.log(`Wallet trouvé pour ${originalId}, account ID: ${wallet.accountId}`);
      return wallet.accountId;
    }
    
    console.log(`Aucun wallet trouvé pour ${originalId}`);
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
    // Convertir la chaîne privateKey en objet PrivateKey
    const privateKeyObj = PrivateKey.fromString(privateKey);
    const signedTx = await txAirdropFrozen.sign(privateKeyObj);
    
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
    
    // Stocker les informations d'airdrop dans la base de données
    try {
      // Récupérer des informations sur le token (on pourra ajouter une fonction pour récupérer le nom plus tard)
      const tokenName = `Token ${tokenId}`; 
      
      // Préparer les données pour la sauvegarde
      const airdropData = {
        creatorId: userId,
        tokenId: tokenId,
        tokenName: tokenName,
        transactionId: txId,
        pendingAirdropId: pendingAirdropId ? pendingAirdropId.toString() : null,
        totalAmount: totalAmount,
        recipients: recipients.map(r => ({
          originalId: r.originalId || null,
          accountId: r.accountId,
          amount: r.amount
        }))
      };
      
      // Sauvegarder l'airdrop dans la base de données
      const storeResult = await storeAirdrop(airdropData);
      
      if (storeResult.success) {
        console.log(`Airdrop sauvegardé en base de données avec l'ID: ${storeResult.airdropId}`);
        result.dbAirdropId = storeResult.airdropId;
      } else {
        console.error(`Erreur lors de la sauvegarde de l'airdrop: ${storeResult.message}`);
      }
    } catch (dbError) {
      console.error(`Erreur lors de l'enregistrement de l'airdrop en base de données: ${dbError.message}`);
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
      
    // Convertir la chaîne privateKey en objet PrivateKey et signer
    const privateKeyObj = PrivateKey.fromString(privateKey);
    const signedTx = await txClaimAirdrop.sign(privateKeyObj);
    
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