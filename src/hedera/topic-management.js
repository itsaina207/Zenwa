/**
 * Fonctionnalités de gestion des topics HCS (Hedera Consensus Service)
 * Implémentations des fonctionnalités du Hedera Agent Kit pour HCS
 */

const { TopicId, TopicMessageSubmitTransaction, TopicCreateTransaction } = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getWalletByUserId } = require('../storage/userWallets');
const { getHederaAgentKit } = require('../agent/hedera-agent-kit-integration');

/**
 * Créer un nouveau topic HCS
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} topicName - Nom du topic
 * @param {boolean} submitKey - Indique si une clé de soumission doit être utilisée
 * @returns {Promise<object>} Résultat de l'opération
 */
async function createTopic(userId, topicName, submitKey = false) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.createTopic) {
      const result = await kit.createTopic(topicName, submitKey);
      return {
        success: result.success,
        message: result.success 
          ? `Topic "${topicName}" créé avec succès, ID: ${result.topicId}`
          : (result.error || 'Erreur lors de la création du topic'),
        topicId: result.topicId,
        transactionId: result.transactionId
      };
    }
    
    // Implémentation de repli utilisant l'API Hedera SDK directement
    const client = getClient();
    
    // Création de la transaction pour le topic
    let topicCreateTx = new TopicCreateTransaction()
      .setTopicMemo(topicName);
      
    // Exécution de la transaction
    const txResponse = await topicCreateTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const topicId = receipt.topicId;
    
    return {
      success: receipt.status.toString() === 'SUCCESS',
      message: receipt.status.toString() === 'SUCCESS' 
        ? `Topic "${topicName}" créé avec succès, ID: ${topicId}`
        : `Erreur lors de la création du topic: ${receipt.status.toString()}`,
      topicId: topicId.toString(),
      transactionId: txResponse.transactionId.toString()
    };
  } catch (error) {
    console.error(`Erreur lors de la création du topic: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors de la création du topic: ${error.message}` 
    };
  }
}

/**
 * Supprimer un topic HCS
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} topicId - ID du topic à supprimer
 * @returns {Promise<object>} Résultat de l'opération
 */
async function deleteTopic(userId, topicId) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.deleteTopic) {
      // Convertir le topicId en objet TopicId si nécessaire
      const topicIdObj = typeof topicId === 'string' 
        ? TopicId.fromString(topicId) 
        : topicId;
      
      const result = await kit.deleteTopic(topicIdObj);
      return {
        success: result.success,
        message: result.success 
          ? `Topic ${topicId} supprimé avec succès`
          : (result.error || 'Erreur lors de la suppression du topic'),
        transactionId: result.transactionId
      };
    }
    
    // Implémentation de repli
    return {
      success: false,
      message: 'La suppression de topic n\'est pas disponible dans cette version'
    };
  } catch (error) {
    console.error(`Erreur lors de la suppression du topic: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors de la suppression du topic: ${error.message}` 
    };
  }
}

/**
 * Soumettre un message à un topic HCS
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} topicId - ID du topic
 * @param {string} message - Message à soumettre
 * @returns {Promise<object>} Résultat de l'opération
 */
async function submitTopicMessage(userId, topicId, message) {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.submitTopicMessage) {
      // Convertir le topicId en objet TopicId si nécessaire
      const topicIdObj = typeof topicId === 'string' 
        ? TopicId.fromString(topicId) 
        : topicId;
      
      const result = await kit.submitTopicMessage(topicIdObj, message);
      return {
        success: result.success,
        message: result.success 
          ? `Message soumis avec succès au topic ${topicId}`
          : (result.error || 'Erreur lors de la soumission du message'),
        transactionId: result.transactionId
      };
    }
    
    // Implémentation de repli utilisant l'API Hedera SDK directement
    const client = getClient();
    
    // Création de la transaction pour soumettre le message
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message);
      
    // Exécution de la transaction
    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    return {
      success: receipt.status.toString() === 'SUCCESS',
      message: receipt.status.toString() === 'SUCCESS' 
        ? `Message soumis avec succès au topic ${topicId}`
        : `Erreur lors de la soumission du message: ${receipt.status.toString()}`,
      transactionId: txResponse.transactionId.toString()
    };
  } catch (error) {
    console.error(`Erreur lors de la soumission du message: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors de la soumission du message: ${error.message}` 
    };
  }
}

/**
 * Obtenir les messages d'un topic HCS
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} topicId - ID du topic
 * @param {string} network - Réseau ('testnet' ou 'mainnet')
 * @returns {Promise<object>} Messages du topic
 */
async function getTopicMessages(userId, topicId, network = 'testnet') {
  try {
    const wallet = await getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, message: 'Portefeuille non trouvé' };
    }

    // Tenter d'utiliser le Hedera Agent Kit
    const kit = await getHederaAgentKit();
    
    if (kit && kit.getTopicMessages) {
      // Convertir le topicId en objet TopicId si nécessaire
      const topicIdObj = typeof topicId === 'string' 
        ? TopicId.fromString(topicId) 
        : topicId;
      
      const result = await kit.getTopicMessages(topicIdObj, network);
      return {
        success: true,
        messages: result,
        topicId: topicId
      };
    }
    
    // Implémentation de repli
    return {
      success: false,
      message: 'Cette fonctionnalité n\'est pas encore implémentée dans cette version'
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des messages: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur lors de la récupération des messages: ${error.message}` 
    };
  }
}

module.exports = {
  createTopic,
  deleteTopic,
  submitTopicMessage,
  getTopicMessages
};