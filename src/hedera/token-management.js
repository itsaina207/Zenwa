/**
 * Fonctionnalités de gestion de tokens avancées
 * Implémentations des fonctionnalités supplémentaires du Hedera Agent Kit
 */

const { TokenId } = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getWalletByUserId } = require('../storage/userWallets');
const { getHederaAgentKit } = require('../agent/hedera-agent-kit-integration');

/**
 * Associer un token à un compte
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} tokenId - ID du token à associer
 * @returns {Promise<object>} Résultat de l'opération
 */
async function associateToken(userId, tokenId) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.associateToken) {
      // Convertir le tokenId en objet TokenId si nécessaire
      const tokenIdObj = typeof tokenId === 'string' 
        ? TokenId.fromString(tokenId) 
        : tokenId;
      
      const result = await kit.associateToken(tokenIdObj);
      return {
        success: result.success,
        message: result.success 
          ? `Token ${tokenId} associé avec succès au compte ${wallet.account_id}`
          : (result.error || 'Erreur lors de l\'association du token'),
        transactionId: result.transactionId
      };
    }
    
    // Implémentation de repli utilisant l'API Hedera SDK directement
    const client = getClient();
    const tokenAssociateTx = await new TokenAssociateTransaction()
      .setAccountId(wallet.account_id)
      .setTokenIds([tokenId])
      .freezeWith(client)
      .sign(PrivateKey.fromString(wallet.private_key));
    
    const submitTx = await tokenAssociateTx.execute(client);
    const receipt = await submitTx.getReceipt(client);
    
    return {
      success: receipt.status.toString() === 'SUCCESS',
      message: receipt.status.toString() === 'SUCCESS'
        ? `Token ${tokenId} associé avec succès au compte ${wallet.account_id}`
        : `Erreur lors de l'association du token: ${receipt.status.toString()}`,
      transactionId: submitTx.transactionId.toString()
    };
  } catch (error) {
    console.error(`Erreur lors de l'association du token: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors de l'association du token: ${error.message}` 
    };
  }
}

/**
 * Dissocier un token d'un compte
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} tokenId - ID du token à dissocier
 * @returns {Promise<object>} Résultat de l'opération
 */
async function dissociateToken(userId, tokenId) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.dissociateToken) {
      // Convertir le tokenId en objet TokenId si nécessaire
      const tokenIdObj = typeof tokenId === 'string' 
        ? TokenId.fromString(tokenId) 
        : tokenId;
      
      const result = await kit.dissociateToken(tokenIdObj);
      return {
        success: result.success,
        message: result.success 
          ? `Token ${tokenId} dissocié avec succès du compte ${wallet.account_id}`
          : (result.error || 'Erreur lors de la dissociation du token'),
        transactionId: result.transactionId
      };
    }
    
    // Implémentation de repli
    return {
      success: false,
      message: 'Cette fonctionnalité n\'est pas encore implémentée dans cette version'
    };
  } catch (error) {
    console.error(`Erreur lors de la dissociation du token: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors de la dissociation du token: ${error.message}` 
    };
  }
}

/**
 * Rejeter un token (refuser un transfert)
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} tokenId - ID du token à rejeter
 * @returns {Promise<object>} Résultat de l'opération
 */
async function rejectToken(userId, tokenId) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.rejectToken) {
      // Convertir le tokenId en objet TokenId si nécessaire
      const tokenIdObj = typeof tokenId === 'string' 
        ? TokenId.fromString(tokenId) 
        : tokenId;
      
      const result = await kit.rejectToken(tokenIdObj);
      return {
        success: result.success,
        message: result.success 
          ? `Token ${tokenId} rejeté avec succès`
          : (result.error || 'Erreur lors du rejet du token'),
        transactionId: result.transactionId
      };
    }
    
    // Implémentation de repli
    return {
      success: false,
      message: 'Cette fonctionnalité n\'est pas encore implémentée dans cette version'
    };
  } catch (error) {
    console.error(`Erreur lors du rejet du token: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors du rejet du token: ${error.message}` 
    };
  }
}

module.exports = {
  associateToken,
  dissociateToken,
  rejectToken
};