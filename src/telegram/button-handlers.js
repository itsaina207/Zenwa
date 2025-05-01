/**
 * Gestionnaires des boutons interactifs pour le bot Telegram
 * Ce module centralise le traitement des actions des boutons
 */

const { getUserLanguage } = require('./language/handler');
const { getBot } = require('./bot');
const { createTokenAirdrop, claimTokenAirdrop } = require('../hedera/airdrop');
const { LOYALTY_STATES } = require('../loyalty/loyalty-states');

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
    try {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ajout de destinataires' });
    } catch (error) {
      console.error('Erreur lors de la réponse au callback query (non bloquant):', error.message);
      // Continuer l'exécution même si le callback échoue
    }
    
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
    
    // Si l'airdrop est déjà en cours de traitement, ignorer ce second clic
    if (userInfo.processingAirdrop) {
      console.log(`[AIRDROP] Ignoré double clic pour l'utilisateur ${userId}`);
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: getUserLanguage(userId) === 'fr' ? 
          "L'airdrop est déjà en cours de traitement..." : 
          "The airdrop is already being processed..." 
      });
      return true;
    }
    
    // Marquer l'airdrop comme étant en cours de traitement
    userInfo.processingAirdrop = true;
    userState.set(userId, userInfo);
    
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
            "🚀 Lancement de l'airdrop en cours... Veuillez patienter." : 
            "🚀 Initiating airdrop... Please wait."
        );
        
        console.log('Tentative de création d\'airdrop pour:', {userId, tokenId: airdropInfo.tokenId, recipients: airdropInfo.recipients});
        const result = await createTokenAirdrop(userId, airdropInfo.tokenId, airdropInfo.recipients);
        console.log('Résultat de l\'airdrop:', JSON.stringify(result, null, 2));
        
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
      // Réinitialiser l'état de l'utilisateur
      userState.delete(userId);
    }
    return true;
  }
  
  // Gérer la réclamation d'airdrop via boutons
  if (action.startsWith('claim_airdrop_')) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Réclamation en cours...' });
    
    const airdropId = action.split('claim_airdrop_')[1];
    const userLang = getUserLanguage(userId);
    
    console.log(`[CLAIM] Tentative de réclamation d'airdrop. Action: ${action}, ID: ${airdropId}, User: ${userId}`);
    
    // Notifier l'utilisateur que le processus a commencé
    await bot.sendMessage(
      chatId, 
      userLang === 'fr' ? 
        "🔄 *Réclamation de l'airdrop en cours...*\n\nVeuillez patienter pendant que nous traitons votre demande." : 
        "🔄 *Claiming airdrop in progress...*\n\nPlease wait while we process your request.",
      { parse_mode: 'Markdown' }
    );
    
    try {
      // Appeler la fonction de réclamation d'airdrop
      const result = await claimTokenAirdrop(userId, airdropId, true); // true = utiliser l'ID de la base de données
      
      console.log(`[CLAIM] Résultat de la réclamation:`, JSON.stringify(result, null, 2));
      
      if (result.success) {
        // Message de succès
        const message = userLang === 'fr' ?
          `✅ *Airdrop réclamé avec succès!*\n\n` +
          `Token: ${result.tokenId || 'N/A'}\n` +
          `Montant: ${result.amount || 'N/A'}\n` +
          `ID de transaction: ${result.transactionId || 'N/A'}\n` +
          `Vérifier sur [HashScan](${result.explorerUrls?.hashscanUrl || 'https://hashscan.io'})` :
          `✅ *Airdrop successfully claimed!*\n\n` +
          `Token: ${result.tokenId || 'N/A'}\n` +
          `Amount: ${result.amount || 'N/A'}\n` +
          `Transaction ID: ${result.transactionId || 'N/A'}\n` +
          `Check on [HashScan](${result.explorerUrls?.hashscanUrl || 'https://hashscan.io'})`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
      } else {
        // Message d'erreur
        let errorMessage;
        
        // Vérifier si c'est une erreur de solde insuffisant
        if (result.errorType === 'INSUFFICIENT_BALANCE') {
          errorMessage = userLang === 'fr' ?
            `⚠️ *Solde HBAR insuffisant*\n\nVous avez seulement ${result.currentBalance} HBAR, mais il vous faut au moins ${result.requiredBalance} HBAR pour cette opération.\n\nVeuillez recharger votre compte et réessayer.` :
            `⚠️ *Insufficient HBAR balance*\n\nYou only have ${result.currentBalance} HBAR, but you need at least ${result.requiredBalance} HBAR for this operation.\n\nPlease top up your account and try again.`;
        } else {
          errorMessage = userLang === 'fr' ?
            `❌ *Erreur lors de la réclamation de l'airdrop*\n\n${result.message}` :
            `❌ *Error claiming airdrop*\n\n${result.message}`;
        }
        
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error(`[CLAIM] Erreur lors de la réclamation:`, error);
      
      await bot.sendMessage(
        chatId,
        userLang === 'fr' ?
          `❌ *Erreur lors de la réclamation de l'airdrop*\n\n${error.message}` :
          `❌ *Error claiming airdrop*\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    }
    
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