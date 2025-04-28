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
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Réclamation de l\'airdrop...' });
    
    const airdropId = action.split('claim_airdrop_')[1];
    const userLang = getUserLanguage(userId);
    
    console.log(`[CLAIM] Demande de réclamation d'airdrop. Action: ${action}, ID: ${airdropId}, User: ${userId}`);
    
    // Notifier l'utilisateur que le processus a commencé
    const processingMsg = await bot.sendMessage(
      chatId, 
      userLang === 'fr' ? 
        "⏳ Réclamation de l'airdrop en cours...\n_Veuillez patienter pendant que nous traitons votre demande..._" : 
        "⏳ Claiming airdrop...\n_Please wait while we process your request..._",
      { parse_mode: 'Markdown' }
    );
    
    try {
      // Obtenir les infos du compte de l'utilisateur
      const { getAccountInfo } = require('../hedera/account');
      const accountInfo = await getAccountInfo(userId);
      if (!accountInfo.success) {
        console.error(`[CLAIM] ❌ Impossible de récupérer les informations du compte pour ${userId}: ${accountInfo.message}`);
        await bot.sendMessage(
          chatId, 
          userLang === 'fr'
            ? `❌ Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
            : `❌ Unable to retrieve your account information: ${accountInfo.message}`
        );
        return true;
      }
      
      console.log(`[CLAIM] ✅ Compte trouvé pour ${userId}: ${accountInfo.accountId}`);
      
      // Obtenir les informations de l'airdrop avant réclamation
      const { getAvailableAirdropsForAccount } = require('../storage/airdrops');
      const availableAirdrops = await getAvailableAirdropsForAccount(accountInfo.accountId);
      const airdropInfo = availableAirdrops.find(a => a.id.toString() === airdropId.toString());
      
      if (airdropInfo) {
        console.log(`[CLAIM] ℹ️ Détails de l'airdrop à réclamer:`, airdropInfo);
      } else {
        console.log(`[CLAIM] ⚠️ Impossible de trouver les détails de l'airdrop ${airdropId} pour le compte ${accountInfo.accountId}`);
      }
      
      // Appeler la fonction de réclamation avec isDbId=true car il s'agit d'un ID de notre base de données
      console.log(`[CLAIM] 🔄 Appel de claimTokenAirdrop avec userId=${userId}, airdropId=${airdropId}, isDbId=true`);
      const result = await claimTokenAirdrop(userId, airdropId, true);
      
      console.log(`[CLAIM] Résultat détaillé de la réclamation:`, JSON.stringify(result, null, 2));
      
      if (result.success) {
        let message;
        
        if (result.transactionId) {
          // Transaction blockchain réalisée
          const hashscanUrl = result.hashscanUrl || `https://hashscan.io/testnet/transaction/${result.transactionId}`;
          const explorerUrl = result.explorerUrl || `https://testnet.hederaexplorer.io/tx/${result.transactionId}`;
          
          // Afficher plus d'informations sur le token, y compris le symbol et treasury si disponibles
          const tokenNameDisplay = result.tokenName || airdropInfo?.tokenName || 'Token';
          const tokenSymbolDisplay = result.tokenSymbol || airdropInfo?.tokenSymbol;
          const tokenIdDisplay = result.tokenId || airdropInfo?.tokenId || 'Non spécifié';
          const tokenDisplay = tokenSymbolDisplay ? `${tokenNameDisplay} (${tokenSymbolDisplay})` : tokenNameDisplay;
          const treasuryId = result.treasuryId || airdropInfo?.treasuryId;
          
          message = userLang === 'fr'
            ? `✅ *Félicitations! Vous avez réclamé avec succès l'airdrop.*\n\n`
              + `🔹 *Token:* ${tokenDisplay}\n`
              + `🔹 *ID du token:* \`${tokenIdDisplay}\`\n`
              + `🔹 *Montant:* ${result.amount || airdropInfo?.amount || 'Non spécifié'}\n`
              + `🔹 *Compte:* \`${accountInfo.accountId}\`\n`
              + (treasuryId ? `🔹 *Compte Treasury:* \`${treasuryId}\`\n` : '')
              + `🔹 *ID de transaction:* \`${result.transactionId}\`\n\n`
              + `🔍 Voir la transaction sur:\n`
              + `[HashScan](${hashscanUrl}) | [Hedera Explorer](${explorerUrl})\n\n`
              + `💼 Le token a été ajouté à votre portefeuille et est maintenant disponible.`
            : `✅ *Congratulations! You have successfully claimed the airdrop.*\n\n`
              + `🔹 *Token:* ${tokenDisplay}\n`
              + `🔹 *Token ID:* \`${tokenIdDisplay}\`\n`
              + `🔹 *Amount:* ${result.amount || airdropInfo?.amount || 'Not specified'}\n`
              + `🔹 *Account:* \`${accountInfo.accountId}\`\n`
              + (treasuryId ? `🔹 *Treasury Account:* \`${treasuryId}\`\n` : '')
              + `🔹 *Transaction ID:* \`${result.transactionId}\`\n\n`
              + `🔍 View transaction on:\n`
              + `[HashScan](${hashscanUrl}) | [Hedera Explorer](${explorerUrl})\n\n`
              + `💼 The token has been added to your wallet and is now available.`;
        } else {
          // Réclamation de base de données uniquement
          // Afficher plus d'informations sur le token, y compris le symbol et treasury si disponibles
          const tokenNameDisplay = result.tokenName || airdropInfo?.tokenName || 'Token';
          const tokenSymbolDisplay = result.tokenSymbol || airdropInfo?.tokenSymbol;
          const tokenIdDisplay = result.tokenId || airdropInfo?.tokenId || 'Non spécifié';
          const tokenDisplay = tokenSymbolDisplay ? `${tokenNameDisplay} (${tokenSymbolDisplay})` : tokenNameDisplay;
          const treasuryId = result.treasuryId || airdropInfo?.treasuryId;
          
          message = userLang === 'fr'
            ? `✅ *Félicitations! Vous avez réclamé avec succès l'airdrop.*\n\n`
              + `🔹 *Token:* ${tokenDisplay}\n`
              + `🔹 *ID du token:* \`${tokenIdDisplay}\`\n`
              + `🔹 *Montant:* ${result.amount || airdropInfo?.amount || 'Non spécifié'}\n`
              + `🔹 *Compte:* \`${accountInfo.accountId}\`\n`
              + (treasuryId ? `🔹 *Compte Treasury:* \`${treasuryId}\`\n` : '')
              + (result.claimedAt ? `🔹 *Réclamé le:* \`${new Date(result.claimedAt).toLocaleString()}\`\n` : '')
              + `\nℹ️ Cet airdrop a été marqué comme réclamé dans notre base de données.`
            : `✅ *Congratulations! You have successfully claimed the airdrop.*\n\n`
              + `🔹 *Token:* ${tokenDisplay}\n`
              + `🔹 *Token ID:* \`${tokenIdDisplay}\`\n`
              + `🔹 *Amount:* ${result.amount || airdropInfo?.amount || 'Not specified'}\n`
              + `🔹 *Account:* \`${accountInfo.accountId}\`\n`
              + (treasuryId ? `🔹 *Treasury Account:* \`${treasuryId}\`\n` : '')
              + (result.claimedAt ? `🔹 *Claimed on:* \`${new Date(result.claimedAt).toLocaleString()}\`\n` : '')
              + `\nℹ️ This airdrop has been marked as claimed in our database.`;
        }
        
        console.log(`[CLAIM] ✅ Envoi du message de succès à l'utilisateur ${userId}`);
        // Modifier le message d'origine plutôt qu'en envoyer un nouveau
        await bot.deleteMessage(chatId, processingMsg.message_id);
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        let errorMessage;
        
        // Vérifier si c'est une erreur de solde insuffisant
        if (result.errorType === 'INSUFFICIENT_BALANCE') {
          // Message spécifique pour le solde insuffisant
          errorMessage = userLang === 'fr'
            ? `⚠️ *Solde HBAR insuffisant*\n\nVous avez seulement ${result.currentBalance} HBAR, mais il vous faut au moins ${result.requiredBalance} HBAR pour cette opération.\n\nVeuillez recharger votre compte et réessayer.`
            : `⚠️ *Insufficient HBAR balance*\n\nYou only have ${result.currentBalance} HBAR, but you need at least ${result.requiredBalance} HBAR for this operation.\n\nPlease top up your account and try again.`;
        } else if (result.message.includes('token') && result.message.includes('associat')) {
          // Message spécifique pour problème d'association de token
          errorMessage = userLang === 'fr'
            ? `❌ *Erreur lors de la réclamation de l'airdrop:*\n\n${result.message}\n\n💡 *Conseil:* Vous pouvez essayer d'associer manuellement le token avec la commande \`/associate [tokenId]\`.`
            : `❌ *Error claiming airdrop:*\n\n${result.message}\n\n💡 *Tip:* You can try to manually associate the token with the command \`/associate [tokenId]\`.`;
        } else {
          // Message d'erreur générique
          errorMessage = userLang === 'fr'
            ? `❌ *Erreur lors de la réclamation de l'airdrop:*\n\n${result.message}`
            : `❌ *Error claiming airdrop:*\n\n${result.message}`;
        }
        
        console.error(`[CLAIM] ❌ Échec de la réclamation pour l'utilisateur ${userId}: ${result.message}`);
        await bot.deleteMessage(chatId, processingMsg.message_id);
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error(`[CLAIM] ❌ Erreur dans claim_airdrop_:`, error);
      console.error('[CLAIM] Stack trace:', error.stack);
      
      const errorMessage = userLang === 'fr'
        ? `❌ *Une erreur s'est produite lors de la réclamation de l'airdrop:*\n\n${error.message}\n\n`
          + "Si le problème persiste, contactez l'administrateur du bot."
        : `❌ *An error occurred while claiming the airdrop:*\n\n${error.message}\n\n`
          + "If the problem persists, please contact the bot administrator.";
      
      await bot.deleteMessage(chatId, processingMsg.message_id);
      await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
    }
    
    // Réinitialiser l'état de l'utilisateur
    userState.delete(userId);
    console.log(`[CLAIM] 🔄 État utilisateur réinitialisé pour ${userId}`);
    return true;
  }
  
  // Bouton non géré par ce module
  return false;
}

module.exports = {
  initialize,
  handleButtonAction
};