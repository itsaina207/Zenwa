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
const { getAccountInfo } = require('./accounts');
const { addExplorerLinks } = require('../utils/explorers');

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
    return addExplorerLinks(result, txId);
    
  } catch (error) {
    console.error('Erreur lors de la création de l\'airdrop:', error);
    return {
      success: false,
      message: `Erreur lors de la création de l'airdrop: ${error.message}`
    };
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
    return addExplorerLinks(result, txId);
    
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
  claimTokenAirdrop
};