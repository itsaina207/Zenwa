/**
 * Gestionnaires des boutons interactifs pour le bot Telegram
 * Ce module centralise le traitement des actions des boutons
 */

const { getUserLanguage } = require('./language/handler');
const { getBot } = require('./bot');
const { createTokenAirdrop, claimTokenAirdrop } = require('../hedera/airdrop');

// Référence au userState partagé
let userState;
let AIRDROP_STATES;

/**
 * Initialise le module avec l'état partagé des utilisateurs
 * @param {Map} sharedUserState - État partagé des utilisateurs
 * @param {Object} airdropStates - États possibles pour les airdrops
 */
function initialize(sharedUserState, airdropStates) {
  userState = sharedUserState;
  AIRDROP_STATES = airdropStates;
  console.log('État des utilisateurs partagé initialisé dans button-handlers.js');
}

/**
 * Traite les actions des boutons interactifs
 * @param {Object} callbackQuery - Objet de requête de callback de Telegram
 * @returns {Promise<boolean>} - true si l'action a été traitée, false sinon
 */
async function handleButtonAction(callbackQuery) {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id.toString();
  const chatId = msg.chat.id;
  const bot = getBot();
  
  // Vérifier que le bot est disponible
  if (!bot) {
    console.error('Bot non disponible dans handleButtonAction');
    return false;
  }
  
  // Traiter les boutons d'airdrop
  if (action === 'airdrop_add_recipient') {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ajout de destinataires' });
    
    // Vérifier que userState est disponible
    if (!userState) {
      console.error('userState non disponible dans handleButtonAction pour airdrop_add_recipient');
      await bot.sendMessage(chatId, "Une erreur est survenue. Veuillez réessayer la commande /airdrop");
      return true;
    }
    
    const userInfo = userState.get(userId) || { state: 'none', airdropInfo: { tokenId: null, recipients: [] } };
    
    // Accéder aux données à partir de airdropInfo
    const airdropInfo = userInfo.airdropInfo || { tokenId: null, recipients: [] };
    
    if (airdropInfo.tokenId) {
      // Mettre l'état sur attente de destinataire
      userInfo.state = AIRDROP_STATES.WAITING_FOR_RECIPIENTS;
      userState.set(userId, userInfo);
      
      // Demander le nouveau destinataire
      const userLang = getUserLanguage(userId);
      await bot.sendMessage(
        chatId,
        userLang === 'fr' 
          ? "Veuillez fournir les IDs des destinataires (format: 0.0.X pour les comptes Hedera ou l'ID numérique Telegram, @nom_utilisateur ou simplement le nom d'utilisateur).\n\nVous pouvez spécifier plusieurs destinataires en les séparant par des virgules.\n\nExemple: 0.0.1234, @utilisateur1, utilisateur2"
          : "Please provide recipient IDs (format: 0.0.X for Hedera accounts or Telegram numeric ID, @username or just username).\n\nYou can specify multiple recipients by separating them with commas.\n\nExample: 0.0.1234, @user1, user2"
      );
    } else {
      // Données d'airdrop invalides
      await bot.sendMessage(
        chatId,
        getUserLanguage(userId) === 'fr'
          ? "❌ Impossible d'ajouter des destinataires: l'airdrop n'a pas été correctement initialisé."
          : "❌ Cannot add recipients: the airdrop was not properly initialized."
      );
    }
    return true;
  }
  
  else if (action === 'airdrop_finalize') {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Finalisation de l\'airdrop...' });
    
    // Vérifier que userState est disponible
    if (!userState) {
      console.error('userState non disponible dans handleButtonAction pour airdrop_finalize');
      await bot.sendMessage(chatId, "Une erreur est survenue. Veuillez réessayer la commande /airdrop");
      return true;
    }
    
    const userInfo = userState.get(userId) || { state: 'none', airdropInfo: { recipients: [], tokenId: null } };
    console.log('userInfo dans airdrop_finalize:', JSON.stringify(userInfo, null, 2));
    
    // Accéder aux données à partir de airdropInfo
    const airdropInfo = userInfo.airdropInfo || { recipients: [], tokenId: null };
    console.log('airdropInfo extraite:', JSON.stringify(airdropInfo, null, 2));
    
    if (airdropInfo.recipients && airdropInfo.recipients.length > 0 && airdropInfo.tokenId) {
      try {
        // Notifier l'utilisateur que le processus a commencé
        const userLang = getUserLanguage(userId);
        await bot.sendMessage(
          chatId, 
          userLang === 'fr' ? 
            "⏳ Finalisation de l'airdrop en cours..." : 
            "⏳ Finalizing airdrop..."
        );
        
        // Exécuter l'airdrop
        console.log('Création de l\'airdrop avec:', {userId, tokenId: airdropInfo.tokenId, recipients: airdropInfo.recipients});
        const result = await createTokenAirdrop(userId, airdropInfo.tokenId, airdropInfo.recipients);
        console.log('Résultat de createTokenAirdrop:', JSON.stringify(result, null, 2));
        // Log supplémentaire pour vérifier si l'ID de base de données a été créé
        if (result.success && result.dbAirdropId) {
          console.log(`✅ Airdrop enregistré en base de données avec l'ID ${result.dbAirdropId}`);
        } else {
          console.log(`❌ Aucun ID de base de données retourné pour l'airdrop`);
        }
        
        // Traiter le résultat
        if (result.success) {
          const message = userLang === 'fr' ?
            `✅ Airdrop réalisé avec succès!\n\n` +
            `ID de transaction: ${result.transactionId}\n` +
            `Explorer: ${result.explorerUrl || 'N/A'}\n` +
            `HashScan: ${result.hashscanUrl || 'N/A'}` :
            `✅ Airdrop successfully completed!\n\n` +
            `Transaction ID: ${result.transactionId}\n` +
            `Explorer: ${result.explorerUrl || 'N/A'}\n` +
            `HashScan: ${result.hashscanUrl || 'N/A'}`;
          
          await bot.sendMessage(chatId, message);
        } else {
          const message = userLang === 'fr' ?
            `❌ Erreur lors de la finalisation de l'airdrop: ${result.message}` :
            `❌ Error finalizing airdrop: ${result.message}`;
          
          await bot.sendMessage(chatId, message);
        }
      } catch (error) {
        console.error(`Error in airdrop_finalize:`, error);
        await bot.sendMessage(
          chatId, 
          getUserLanguage(userId) === 'fr' ?
            `❌ Une erreur s'est produite lors de la finalisation de l'airdrop: ${error.message}` :
            `❌ An error occurred while finalizing the airdrop: ${error.message}`
        );
      }
      
      // Réinitialiser l'état de l'utilisateur
      userState.delete(userId);
    } else {
      // Données d'airdrop invalides
      await bot.sendMessage(
        chatId, 
        getUserLanguage(userId) === 'fr' ?
          "❌ Impossible de finaliser l'airdrop: données incomplètes" :
          "❌ Cannot finalize airdrop: incomplete data"
      );
    }
    return true;
  }
  
  // Gérer la réclamation d'airdrop via boutons
  if (action.startsWith('claim_airdrop_')) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Réclamation de l\'airdrop...' });
    
    const airdropId = action.split('claim_airdrop_')[1];
    const userLang = getUserLanguage(userId);
    
    console.log(`Demande de réclamation d'airdrop. Action: ${action}, ID: ${airdropId}, User: ${userId}`);
    
    // Notifier l'utilisateur que le processus a commencé
    await bot.sendMessage(
      chatId, 
      userLang === 'fr' ? 
        "⏳ Réclamation de l'airdrop en cours..." : 
        "⏳ Claiming airdrop..."
    );
    
    try {
      // Obtenir les infos du compte de l'utilisateur
      const { getAccountInfo } = require('../hedera/account');
      const accountInfo = await getAccountInfo(userId);
      if (!accountInfo.success) {
        console.error(`Impossible de récupérer les informations du compte pour ${userId}: ${accountInfo.message}`);
        await bot.sendMessage(
          chatId, 
          userLang === 'fr'
            ? `❌ Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
            : `❌ Unable to retrieve your account information: ${accountInfo.message}`
        );
        return true;
      }
      
      console.log(`Compte trouvé pour ${userId}: ${accountInfo.accountId}`);
      
      // Appeler la fonction de réclamation avec isDbId=true car il s'agit d'un ID de notre base de données
      console.log(`Appel de claimTokenAirdrop avec userId=${userId}, airdropId=${airdropId}, isDbId=true`);
      const result = await claimTokenAirdrop(userId, airdropId, true);
      
      console.log(`Résultat de la réclamation:`, result);
      
      if (result.success) {
        let message;
        
        if (result.transactionId) {
          // Transaction blockchain réalisée
          message = userLang === 'fr'
            ? `✅ Félicitations! Vous avez réclamé avec succès l'airdrop.\n\n`
              + `ID de transaction: ${result.transactionId}\n`
              + `Explorer: ${result.explorerUrl || 'N/A'}\n`
              + `HashScan: ${result.hashscanUrl || 'N/A'}`
            : `✅ Congratulations! You have successfully claimed the airdrop.\n\n`
              + `Transaction ID: ${result.transactionId}\n`
              + `Explorer: ${result.explorerUrl || 'N/A'}\n`
              + `HashScan: ${result.hashscanUrl || 'N/A'}`;
        } else {
          // Réclamation de base de données uniquement
          message = userLang === 'fr'
            ? `✅ Félicitations! Vous avez réclamé avec succès l'airdrop.\n\n`
              + `Nom du token: ${result.tokenName || 'Token'}\n`
              + `ID du token: ${result.tokenId || 'N/A'}\n`
              + `Montant: ${result.amount || 'N/A'}`
            : `✅ Congratulations! You have successfully claimed the airdrop.\n\n`
              + `Token name: ${result.tokenName || 'Token'}\n`
              + `Token ID: ${result.tokenId || 'N/A'}\n`
              + `Amount: ${result.amount || 'N/A'}`;
        }
        
        console.log(`Envoi du message de succès à l'utilisateur ${userId}`);
        await bot.sendMessage(chatId, message);
      } else {
        const errorMessage = userLang === 'fr'
          ? `❌ Erreur lors de la réclamation de l'airdrop: ${result.message}`
          : `❌ Error claiming airdrop: ${result.message}`;
        
        console.error(`Échec de la réclamation pour l'utilisateur ${userId}: ${result.message}`);
        await bot.sendMessage(chatId, errorMessage);
      }
    } catch (error) {
      console.error(`Erreur dans claim_airdrop_:`, error);
      console.error('Stack trace:', error.stack);
      await bot.sendMessage(
        chatId, 
        userLang === 'fr'
          ? `❌ Une erreur s'est produite lors de la réclamation de l'airdrop: ${error.message}`
          : `❌ An error occurred while claiming the airdrop: ${error.message}`
      );
    }
    
    // Réinitialiser l'état de l'utilisateur
    userState.delete(userId);
    console.log(`État utilisateur réinitialisé pour ${userId}`);
    return true;
  }
  
  // Bouton non géré par ce module
  return false;
}

module.exports = {
  initialize,
  handleButtonAction
};