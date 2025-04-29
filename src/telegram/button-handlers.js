/**
 * Gestionnaires des boutons interactifs pour le bot Telegram
 * Ce module centralise le traitement des actions des boutons
 */

const { getUserLanguage } = require('./language/handler');
const { getBot } = require('./bot');
// Fonctionnalités d'airdrop temporairement désactivées pour refactoring
// const { createTokenAirdrop, claimTokenAirdrop } = require('../hedera/airdrop');

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
            "⚠️ La fonctionnalité d'airdrop est temporairement indisponible pour maintenance." : 
            "⚠️ The airdrop feature is temporarily unavailable for maintenance."
        );
        
        // Fonctionnalité d'airdrop temporairement désactivée pour refactoring
        console.log('Tentative de création d\'airdrop désactivée pour:', {userId, tokenId: airdropInfo.tokenId, recipients: airdropInfo.recipients});
        // const result = await createTokenAirdrop(userId, airdropInfo.tokenId, airdropInfo.recipients);
        const result = { 
          success: false, 
          message: "Fonctionnalité temporairement désactivée pour maintenance",
          errorType: "FEATURE_DISABLED"
        };
        console.log('Résultat de la tentative désactivée:', JSON.stringify(result, null, 2));
        
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
          // Gestion des erreurs avec des messages plus précis
          let errorMessage;
          
          // Vérifier si c'est une erreur de solde insuffisant
          if (result.errorType === 'INSUFFICIENT_BALANCE') {
            // Message spécifique pour le solde insuffisant
            errorMessage = userLang === 'fr'
              ? `⚠️ Solde HBAR insuffisant: Vous avez seulement ${result.currentBalance} HBAR, mais il vous faut au moins ${result.requiredBalance} HBAR pour cette opération.\n\nVeuillez recharger votre compte et réessayer.`
              : `⚠️ Insufficient HBAR balance: You only have ${result.currentBalance} HBAR, but you need at least ${result.requiredBalance} HBAR for this operation.\n\nPlease top up your account and try again.`;
          } else {
            // Message d'erreur générique
            errorMessage = userLang === 'fr'
              ? `❌ Erreur lors de la finalisation de l'airdrop: ${result.message}`
              : `❌ Error finalizing airdrop: ${result.message}`;
          }
            
          await bot.sendMessage(chatId, errorMessage);
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
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Fonctionnalité désactivée' });
    
    const airdropId = action.split('claim_airdrop_')[1];
    const userLang = getUserLanguage(userId);
    
    console.log(`[CLAIM] Tentative de réclamation d'airdrop désactivée. Action: ${action}, ID: ${airdropId}, User: ${userId}`);
    
    // Notifier l'utilisateur que la fonctionnalité est désactivée
    await bot.sendMessage(
      chatId, 
      userLang === 'fr' ? 
        "⚠️ *La fonctionnalité de réclamation d'airdrop est temporairement désactivée pour maintenance.*\n\nNous travaillons à son amélioration et elle sera bientôt de retour." : 
        "⚠️ *The airdrop claim feature is temporarily disabled for maintenance.*\n\nWe are working on improving it and it will be back soon.",
      { parse_mode: 'Markdown' }
    );
    
    return true;
    
    // Tout le code de traitement d'airdrop est temporairement désactivé pour refactoring
    
    // Réinitialiser l'état de l'utilisateur
    userState.delete(userId);
    return true;
  }
  
  // Bouton non géré par ce module
  return false;
}

module.exports = {
  initialize,
  handleButtonAction
};