/**
 * Gestionnaire des commandes d'airdrop et de campagnes pour le bot Telegram
 */

const { createTokenAirdrop, claimTokenAirdrop } = require('../hedera/airdrop');
const { 
  createCampaign, 
  getCampaign, 
  getActiveCampaigns, 
  getUserCampaigns,
  claimFromCampaign,
  updateCampaignStatus
} = require('../hedera/campaigns');
const { getUserLanguage, translate } = require('./language/handler');

// États de conversation pour les airdrops et campagnes
const AIRDROP_STATES = {
  WAITING_FOR_TOKEN_ID: 'waiting_for_token_id',
  WAITING_FOR_RECIPIENTS: 'waiting_for_recipients',
  WAITING_FOR_AMOUNT: 'waiting_for_amount',
  WAITING_FOR_CONFIRMATION: 'waiting_for_confirmation'
};

const CAMPAIGN_STATES = {
  WAITING_FOR_NAME: 'waiting_for_name',
  WAITING_FOR_DESCRIPTION: 'waiting_for_description',
  WAITING_FOR_TOKEN_ID: 'waiting_for_token_id',
  WAITING_FOR_TOTAL_AMOUNT: 'waiting_for_total_amount',
  WAITING_FOR_AMOUNT_PER_CLAIM: 'waiting_for_amount_per_claim',
  WAITING_FOR_MAX_CLAIMS: 'waiting_for_max_claims',
  WAITING_FOR_CONFIRMATION: 'waiting_for_confirmation'
};

const CLAIM_STATES = {
  WAITING_FOR_CAMPAIGN_ID: 'waiting_for_campaign_id',
  WAITING_FOR_AIRDROP_ID: 'waiting_for_airdrop_id'
};

// Map pour stocker les états de conversation des utilisateurs
const userState = new Map();

/**
 * Gestionnaire de la commande /airdrop
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleAirdrop(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  
  // Initialiser l'état de l'utilisateur pour l'airdrop
  userState.set(userId, {
    state: AIRDROP_STATES.WAITING_FOR_TOKEN_ID,
    chatId,
    tokenId: null,
    recipients: [],
    amount: null
  });
  
  await bot.sendMessage(
    chatId,
    translate(userId, 'airdropIntro'),
    { parse_mode: 'Markdown' }
  );
  
  // Demander l'ID du token
  await bot.sendMessage(
    chatId,
    translate(userId, 'airdropTokenIdPrompt'),
    { reply_markup: { force_reply: true } }
  );
}

/**
 * Gestionnaire de la commande /campaign
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleCampaign(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  
  // Initialiser l'état de l'utilisateur pour la campagne
  userState.set(userId, {
    state: CAMPAIGN_STATES.WAITING_FOR_NAME,
    chatId,
    campaignInfo: {
      name: null,
      description: null,
      tokenId: null,
      totalAmount: null,
      amountPerClaim: null,
      maxClaims: null
    }
  });
  
  await bot.sendMessage(
    chatId,
    translate(userId, 'campaignIntro'),
    { parse_mode: 'Markdown' }
  );
  
  // Demander le nom de la campagne
  await bot.sendMessage(
    chatId,
    translate(userId, 'campaignNamePrompt'),
    { reply_markup: { force_reply: true } }
  );
}

/**
 * Gestionnaire de la commande /claim
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleClaim(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  const args = msg.text.split(' ').slice(1);
  
  // Si un ID de campagne est fourni directement
  if (args.length > 0) {
    const campaignId = args[0];
    const result = await claimFromCampaign(userId, campaignId);
    
    if (result.success) {
      await bot.sendMessage(
        chatId,
        `✅ ${result.message}\n\nToken ID: \`${result.tokenId}\`\nMontant: ${result.amount}\n\n[Voir dans l'explorateur](${result.explorerUrl})`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }
    return;
  }
  
  // Sinon, démarrer le processus interactif de réclamation
  const activeCampaigns = getActiveCampaigns();
  
  if (activeCampaigns.length === 0) {
    await bot.sendMessage(
      chatId,
      translate(userId, 'noActiveCampaigns')
    );
    return;
  }
  
  // Initialiser l'état de l'utilisateur pour la réclamation
  userState.set(userId, {
    state: CLAIM_STATES.WAITING_FOR_CAMPAIGN_ID,
    chatId
  });
  
  // Afficher la liste des campagnes actives
  let message = translate(userId, 'activeCampaignsHeader') + '\n\n';
  
  activeCampaigns.forEach((campaign, index) => {
    message += `${index + 1}. *${campaign.name}*\n`;
    message += `   ID: \`${campaign.id}\`\n`;
    message += `   Token: \`${campaign.tokenId}\`\n`;
    message += `   Par réclamation: ${campaign.amountPerClaim}\n`;
    message += `   Restant: ${campaign.remainingAmount}/${campaign.totalAmount}\n\n`;
  });
  
  message += translate(userId, 'campaignIdPrompt');
  
  await bot.sendMessage(
    chatId,
    message,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Gestionnaire de la commande /mycampaigns
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleMyCampaigns(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  
  const userCampaigns = getUserCampaigns(userId);
  
  if (userCampaigns.length === 0) {
    await bot.sendMessage(
      chatId,
      translate(userId, 'noUserCampaigns')
    );
    return;
  }
  
  let message = translate(userId, 'userCampaignsHeader') + '\n\n';
  
  userCampaigns.forEach((campaign, index) => {
    message += `${index + 1}. *${campaign.name}*\n`;
    message += `   ID: \`${campaign.id}\`\n`;
    message += `   Statut: ${campaign.status}\n`;
    message += `   Token: \`${campaign.tokenId}\`\n`;
    message += `   Réclamations: ${campaign.claimCount}${campaign.maxClaims > 0 ? `/${campaign.maxClaims}` : ''}\n`;
    message += `   Restant: ${campaign.remainingAmount}/${campaign.totalAmount}\n\n`;
  });
  
  message += translate(userId, 'campaignManagementHelp');
  
  await bot.sendMessage(
    chatId,
    message,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Gestionnaire de la commande /campaigninfo
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleCampaignInfo(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  const args = msg.text.split(' ').slice(1);
  
  if (args.length === 0) {
    await bot.sendMessage(
      chatId,
      translate(userId, 'campaignIdMissing')
    );
    return;
  }
  
  const campaignId = args[0];
  const campaign = getCampaign(campaignId);
  
  if (!campaign) {
    await bot.sendMessage(
      chatId,
      translate(userId, 'campaignNotFound')
    );
    return;
  }
  
  let message = `📣 *Informations sur la Campagne*\n\n`;
  message += `Nom: *${campaign.name}*\n`;
  message += `Description: ${campaign.description}\n`;
  message += `Token ID: \`${campaign.tokenId}\`\n`;
  message += `Statut: ${campaign.status}\n`;
  message += `Montant total: ${campaign.totalAmount}\n`;
  message += `Montant par réclamation: ${campaign.amountPerClaim}\n`;
  message += `Réclamations: ${campaign.claimCount}${campaign.maxClaims > 0 ? `/${campaign.maxClaims}` : ' (illimité)'}\n`;
  message += `Restant: ${campaign.remainingAmount}\n`;
  message += `Créée le: ${new Date(campaign.createdAt).toLocaleString()}\n\n`;
  
  if (campaign.creatorId === userId) {
    message += translate(userId, 'campaignManagementOptions');
  } else if (campaign.status === 'active' && !campaign.claimedBy.includes(userId)) {
    message += `Pour réclamer des tokens de cette campagne: /claim ${campaignId}`;
  }
  
  await bot.sendMessage(
    chatId,
    message,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Gestionnaire de la commande /campaignstatus
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleCampaignStatus(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  const args = msg.text.split(' ').slice(1);
  
  if (args.length < 2) {
    await bot.sendMessage(
      chatId,
      translate(userId, 'campaignStatusUsage')
    );
    return;
  }
  
  const campaignId = args[0];
  const newStatus = args[1].toLowerCase();
  
  const result = updateCampaignStatus(userId, campaignId, newStatus);
  
  if (result.success) {
    await bot.sendMessage(
      chatId,
      `✅ ${result.message}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await bot.sendMessage(
      chatId,
      `❌ ${result.message}`
    );
  }
}

/**
 * Gestionnaire de la commande /claimairdrop
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleClaimAirdrop(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const lang = getUserLanguage(userId);
  const args = msg.text.split(' ').slice(1);
  
  if (args.length === 0) {
    // Initialiser l'état de l'utilisateur pour la réclamation d'airdrop
    userState.set(userId, {
      state: CLAIM_STATES.WAITING_FOR_AIRDROP_ID,
      chatId
    });
    
    await bot.sendMessage(
      chatId,
      translate(userId, 'airdropIdPrompt'),
      { reply_markup: { force_reply: true } }
    );
    return;
  }
  
  const pendingAirdropId = args[0];
  const result = await claimTokenAirdrop(userId, pendingAirdropId);
  
  if (result.success) {
    await bot.sendMessage(
      chatId,
      `✅ ${result.message}\n\n[Voir dans l'explorateur](${result.explorerUrl})`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await bot.sendMessage(
      chatId,
      `❌ ${result.message}`
    );
  }
}

/**
 * Gestionnaire des conversations pour les airdrops et campagnes
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 * @returns {boolean} true si le message a été traité, false sinon
 */
async function handleAirdropConversation(bot, msg) {
  const userId = msg.from.id.toString();
  const userInfo = userState.get(userId);
  
  if (!userInfo) {
    return false;
  }
  
  const chatId = userInfo.chatId;
  const text = msg.text.trim();
  
  try {
    // Traitement des conversations d'airdrop
    if (userInfo.state && userInfo.state.startsWith('waiting_for_')) {
      // Airdrop simple
      if (userInfo.state === AIRDROP_STATES.WAITING_FOR_TOKEN_ID) {
        userInfo.tokenId = text;
        userInfo.state = AIRDROP_STATES.WAITING_FOR_RECIPIENTS;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'airdropRecipientsPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === AIRDROP_STATES.WAITING_FOR_RECIPIENTS) {
        // Format attendu: 0.0.12345,0.0.67890,0.0.54321
        const recipientIds = text.split(',').map(id => id.trim());
        
        if (recipientIds.length === 0) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'airdropInvalidRecipients')
          );
          return true;
        }
        
        userInfo.recipients = recipientIds.map(id => ({
          accountId: id,
          amount: null
        }));
        userInfo.state = AIRDROP_STATES.WAITING_FOR_AMOUNT;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'airdropAmountPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === AIRDROP_STATES.WAITING_FOR_AMOUNT) {
        const amount = parseInt(text, 10);
        
        if (isNaN(amount) || amount <= 0) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'airdropInvalidAmount')
          );
          return true;
        }
        
        // Mettre à jour les montants pour tous les destinataires
        userInfo.recipients = userInfo.recipients.map(recipient => ({
          ...recipient,
          amount
        }));
        
        userInfo.state = AIRDROP_STATES.WAITING_FOR_CONFIRMATION;
        userState.set(userId, userInfo);
        
        // Demander confirmation
        let message = translate(userId, 'airdropConfirmationHeader') + '\n\n';
        message += `Token ID: \`${userInfo.tokenId}\`\n`;
        message += `Nombre de destinataires: ${userInfo.recipients.length}\n`;
        message += `Montant par destinataire: ${amount}\n`;
        message += `Montant total: ${amount * userInfo.recipients.length}\n\n`;
        
        message += translate(userId, 'airdropConfirmationPrompt');
        
        await bot.sendMessage(
          chatId,
          message,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [['✅ Confirmer', '❌ Annuler']],
              one_time_keyboard: true,
              resize_keyboard: true
            }
          }
        );
        return true;
      }
      else if (userInfo.state === AIRDROP_STATES.WAITING_FOR_CONFIRMATION) {
        if (text.includes('Confirmer')) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'airdropProcessing'),
            { reply_markup: { remove_keyboard: true } }
          );
          
          const result = await createTokenAirdrop(
            userId,
            userInfo.tokenId,
            userInfo.recipients
          );
          
          if (result.success) {
            let message = `✅ ${result.message}\n\n`;
            message += `Token ID: \`${result.tokenId}\`\n`;
            message += `Nombre de destinataires: ${result.recipientCount}\n`;
            message += `Montant total: ${result.totalAmount}\n\n`;
            
            if (result.pendingAirdropId) {
              message += `ID d'airdrop: \`${result.pendingAirdropId}\`\n\n`;
              message += `Les destinataires peuvent réclamer leurs tokens avec:\n`;
              message += `/claimairdrop ${result.pendingAirdropId}\n\n`;
            }
            
            message += `[Voir dans l'explorateur](${result.explorerUrl})`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          } else {
            await bot.sendMessage(chatId, `❌ ${result.message}`);
          }
          
          // Réinitialiser l'état
          userState.delete(userId);
        } else {
          await bot.sendMessage(
            chatId,
            translate(userId, 'airdropCancelled'),
            { reply_markup: { remove_keyboard: true } }
          );
          userState.delete(userId);
        }
        return true;
      }
      
      // Campagne
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_NAME) {
        userInfo.campaignInfo.name = text;
        userInfo.state = CAMPAIGN_STATES.WAITING_FOR_DESCRIPTION;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'campaignDescriptionPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_DESCRIPTION) {
        userInfo.campaignInfo.description = text;
        userInfo.state = CAMPAIGN_STATES.WAITING_FOR_TOKEN_ID;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'campaignTokenIdPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_TOKEN_ID) {
        userInfo.campaignInfo.tokenId = text;
        userInfo.state = CAMPAIGN_STATES.WAITING_FOR_TOTAL_AMOUNT;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'campaignTotalAmountPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_TOTAL_AMOUNT) {
        const totalAmount = parseInt(text, 10);
        
        if (isNaN(totalAmount) || totalAmount <= 0) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'campaignInvalidAmount')
          );
          return true;
        }
        
        userInfo.campaignInfo.totalAmount = totalAmount;
        userInfo.state = CAMPAIGN_STATES.WAITING_FOR_AMOUNT_PER_CLAIM;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'campaignAmountPerClaimPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_AMOUNT_PER_CLAIM) {
        const amountPerClaim = parseInt(text, 10);
        
        if (isNaN(amountPerClaim) || amountPerClaim <= 0) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'campaignInvalidAmount')
          );
          return true;
        }
        
        if (amountPerClaim > userInfo.campaignInfo.totalAmount) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'campaignAmountTooLarge')
          );
          return true;
        }
        
        userInfo.campaignInfo.amountPerClaim = amountPerClaim;
        userInfo.state = CAMPAIGN_STATES.WAITING_FOR_MAX_CLAIMS;
        userState.set(userId, userInfo);
        
        await bot.sendMessage(
          chatId,
          translate(userId, 'campaignMaxClaimsPrompt'),
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_MAX_CLAIMS) {
        let maxClaims = parseInt(text, 10);
        
        if (text.toLowerCase() === 'illimité' || text.toLowerCase() === 'unlimited' || text === '0') {
          maxClaims = 0; // 0 = illimité
        } else if (isNaN(maxClaims) || maxClaims < 0) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'campaignInvalidMaxClaims')
          );
          return true;
        }
        
        userInfo.campaignInfo.maxClaims = maxClaims;
        userInfo.state = CAMPAIGN_STATES.WAITING_FOR_CONFIRMATION;
        userState.set(userId, userInfo);
        
        // Calculer le nombre maximum de réclamations basé sur le montant total et le montant par réclamation
        const maxPossibleClaims = Math.floor(userInfo.campaignInfo.totalAmount / userInfo.campaignInfo.amountPerClaim);
        
        // Demander confirmation
        let message = translate(userId, 'campaignConfirmationHeader') + '\n\n';
        message += `Nom: *${userInfo.campaignInfo.name}*\n`;
        message += `Description: ${userInfo.campaignInfo.description}\n`;
        message += `Token ID: \`${userInfo.campaignInfo.tokenId}\`\n`;
        message += `Montant total: ${userInfo.campaignInfo.totalAmount}\n`;
        message += `Montant par réclamation: ${userInfo.campaignInfo.amountPerClaim}\n`;
        message += `Nombre maximum de réclamations: ${maxClaims === 0 ? 'Illimité' : maxClaims}\n`;
        message += `Réclamations possibles avec ce montant: ${maxPossibleClaims}\n\n`;
        
        message += translate(userId, 'campaignConfirmationPrompt');
        
        await bot.sendMessage(
          chatId,
          message,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [['✅ Confirmer', '❌ Annuler']],
              one_time_keyboard: true,
              resize_keyboard: true
            }
          }
        );
        return true;
      }
      else if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_CONFIRMATION) {
        if (text.includes('Confirmer')) {
          await bot.sendMessage(
            chatId,
            translate(userId, 'campaignCreating'),
            { reply_markup: { remove_keyboard: true } }
          );
          
          const result = createCampaign(userId, userInfo.campaignInfo);
          
          if (result.success) {
            let message = `✅ ${result.message}\n\n`;
            message += `Nom: *${result.campaign.name}*\n`;
            message += `ID: \`${result.campaignId}\`\n`;
            message += `Token ID: \`${result.campaign.tokenId}\`\n\n`;
            
            message += `Les utilisateurs peuvent récupérer des tokens avec:\n`;
            message += `/claim ${result.campaignId}\n\n`;
            
            message += `Utilisez /campaigninfo ${result.campaignId} pour voir les détails de la campagne.`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          } else {
            await bot.sendMessage(chatId, `❌ ${result.message}`);
          }
          
          // Réinitialiser l'état
          userState.delete(userId);
        } else {
          await bot.sendMessage(
            chatId,
            translate(userId, 'campaignCancelled'),
            { reply_markup: { remove_keyboard: true } }
          );
          userState.delete(userId);
        }
        return true;
      }
      
      // Réclamation
      else if (userInfo.state === CLAIM_STATES.WAITING_FOR_CAMPAIGN_ID) {
        // Vérifier si l'utilisateur a entré un indice ou un ID de campagne
        const activeCampaigns = getActiveCampaigns();
        let campaignId;
        
        const index = parseInt(text, 10);
        if (!isNaN(index) && index > 0 && index <= activeCampaigns.length) {
          // L'utilisateur a entré un indice valide
          campaignId = activeCampaigns[index - 1].id;
        } else {
          // L'utilisateur a peut-être entré un ID directement
          campaignId = text;
        }
        
        const result = await claimFromCampaign(userId, campaignId);
        
        if (result.success) {
          await bot.sendMessage(
            chatId,
            `✅ ${result.message}\n\nToken ID: \`${result.tokenId}\`\nMontant: ${result.amount}\n\n[Voir dans l'explorateur](${result.explorerUrl})`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await bot.sendMessage(chatId, `❌ ${result.message}`);
        }
        
        // Réinitialiser l'état
        userState.delete(userId);
        return true;
      }
      else if (userInfo.state === CLAIM_STATES.WAITING_FOR_AIRDROP_ID) {
        const pendingAirdropId = text;
        const result = await claimTokenAirdrop(userId, pendingAirdropId);
        
        if (result.success) {
          await bot.sendMessage(
            chatId,
            `✅ ${result.message}\n\n[Voir dans l'explorateur](${result.explorerUrl})`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await bot.sendMessage(chatId, `❌ ${result.message}`);
        }
        
        // Réinitialiser l'état
        userState.delete(userId);
        return true;
      }
    }
  } catch (error) {
    console.error(`Erreur dans handleAirdropConversation: ${error.message}`);
    await bot.sendMessage(
      chatId,
      `❌ Une erreur est survenue: ${error.message}`,
      { reply_markup: { remove_keyboard: true } }
    );
    userState.delete(userId);
    return true;
  }
  
  return false;
}

module.exports = {
  handleAirdrop,
  handleCampaign,
  handleClaim,
  handleMyCampaigns,
  handleCampaignInfo,
  handleCampaignStatus,
  handleClaimAirdrop,
  handleAirdropConversation,
  AIRDROP_STATES,
  CAMPAIGN_STATES,
  CLAIM_STATES,
  userState
};