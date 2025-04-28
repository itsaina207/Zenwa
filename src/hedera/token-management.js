/**
 * Fonctionnalités de gestion de tokens avancées
 * Implémentations des fonctionnalités supplémentaires du Hedera Agent Kit
 */

const { TokenId, TokenAssociateTransaction, TokenDissociateTransaction, PrivateKey, AccountId } = require('@hashgraph/sdk');
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
    console.log('Wallet info:', JSON.stringify({
      userId: wallet?.userId,
      accountId: wallet?.accountId,
      privateKeyLength: wallet?.privateKey?.length || 0
    }, null, 2));
    
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé. Veuillez créer un wallet avec /createwallet' };
    }

    if (!wallet.accountId || !wallet.privateKey) {
      return { 
        success: false, 
        message: 'Données de wallet incomplètes. Veuillez recréer votre wallet avec /createwallet'
      };
    }

    // Implémentation directe avec l'API Hedera SDK
    console.log(`Associating token ${tokenId} to account ${wallet.accountId}`);
    
    // Convertir le tokenId en objet TokenId
    const tokenIdObj = TokenId.fromString(tokenId);
    const accountId = AccountId.fromString(wallet.accountId);
    
    const client = getClient();
    
    // Créer la transaction d'association
    const transaction = new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([tokenIdObj])
      .setMaxTransactionFee(new Hbar(0.05)); // Limitation des frais à 0.05 HBAR pour éviter INSUFFICIENT_PAYER_BALANCE
      
    // Signer la transaction avec la clé du compte
    const privateKey = PrivateKey.fromString(wallet.privateKey);
    
    // Faire l'opération en plusieurs étapes plutôt qu'en chaîne
    const frozenTx = await transaction.freezeWith(client);
    const signedTx = await frozenTx.sign(privateKey);
    
    // Exécuter la transaction et attendre le reçu
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const success = receipt.status.toString() === 'SUCCESS';
    
    return {
      success: success,
      message: success
        ? `Token ${tokenId} associé avec succès au compte ${wallet.accountId}`
        : `Erreur lors de l'association du token: ${receipt.status.toString()}`,
      transactionId: txResponse.transactionId.toString()
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
      return { success: false, message: 'Portefeuille non trouvé. Veuillez créer un wallet avec /createwallet' };
    }

    if (!wallet.accountId || !wallet.privateKey) {
      return { 
        success: false, 
        message: 'Données de wallet incomplètes. Veuillez recréer votre wallet avec /createwallet'
      };
    }

    // Implémentation directe avec l'API Hedera SDK
    console.log(`Dissociating token ${tokenId} from account ${wallet.accountId}`);
    
    // Convertir le tokenId en objet TokenId
    const tokenIdObj = TokenId.fromString(tokenId);
    const accountId = AccountId.fromString(wallet.accountId);
    
    const client = getClient();
    
    // Créer la transaction de dissociation
    const transaction = new TokenDissociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([tokenIdObj]);
      
    // Signer la transaction avec la clé du compte
    const privateKey = PrivateKey.fromString(wallet.privateKey);
    
    // Faire l'opération en plusieurs étapes plutôt qu'en chaîne
    const frozenTx = await transaction.freezeWith(client);
    const signedTx = await frozenTx.sign(privateKey);
    
    // Exécuter la transaction et attendre le reçu
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const success = receipt.status.toString() === 'SUCCESS';
    
    return {
      success: success,
      message: success
        ? `Token ${tokenId} dissocié avec succès du compte ${wallet.accountId}`
        : `Erreur lors de la dissociation du token: ${receipt.status.toString()}`,
      transactionId: txResponse.transactionId.toString()
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