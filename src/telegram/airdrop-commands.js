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
const { getUserLanguage, translate } = require('../utils/localizations');

// État pour le suivi des conversations d'airdrop
const AIRDROP_STATES = {
  WAITING_FOR_TOKEN_ID: 'waiting_for_token_id_airdrop',
  WAITING_FOR_RECIPIENTS: 'waiting_for_recipients_airdrop',
  WAITING_FOR_RECIPIENT_ID: 'waiting_for_recipient_id',
  WAITING_FOR_AMOUNT: 'waiting_for_amount_airdrop',
  WAITING_FOR_CONFIRMATION: 'waiting_for_confirmation_airdrop',
  NONE: 'none_airdrop'
};

// État pour le suivi des conversations de campagnes
const CAMPAIGN_STATES = {
  WAITING_FOR_TOKEN_ID: 'waiting_for_token_id_campaign',
  WAITING_FOR_NAME: 'waiting_for_name_campaign',
  WAITING_FOR_DESCRIPTION: 'waiting_for_description_campaign',
  WAITING_FOR_AMOUNT_PER_USER: 'waiting_for_amount_per_user',
  WAITING_FOR_TOTAL_AMOUNT: 'waiting_for_total_amount',
  WAITING_FOR_END_DATE: 'waiting_for_end_date',
  WAITING_FOR_CONFIRMATION: 'waiting_for_confirmation_campaign',
  NONE: 'none_campaign'
};

// État pour le suivi des conversations de réclamation
const CLAIM_STATES = {
  WAITING_FOR_CAMPAIGN_ID: 'waiting_for_campaign_id',
  WAITING_FOR_AIRDROP_ID: 'waiting_for_airdrop_id',
  NONE: 'none_claim'
};

// On va partager l'état des utilisateurs avec le module principal
// pour éviter les problèmes de synchronisation entre les différents gestionnaires
let userState;

/**
 * Gestionnaire de la commande /airdrop
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleAirdrop(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  
  // Initialiser l'état de l'utilisateur
  userState.set(userId, {
    state: AIRDROP_STATES.WAITING_FOR_TOKEN_ID,
    airdropInfo: {
      recipients: []
    }
  });
  
  const message = userLang === 'fr' 
    ? "Vous allez créer un airdrop de tokens.\n\nVeuillez d'abord indiquer l'ID du token à distribuer (format: 0.0.X):"
    : "You are going to create a token airdrop.\n\nPlease provide the token ID to distribute (format: 0.0.X):";
    
  await bot.sendMessage(chatId, message);
}

/**
 * Gestionnaire de la commande /campaign
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleCampaign(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  
  // Initialiser l'état de l'utilisateur
  userState.set(userId, {
    state: CAMPAIGN_STATES.WAITING_FOR_TOKEN_ID,
    campaignInfo: {}
  });
  
  const message = userLang === 'fr' 
    ? "Vous allez créer une campagne de distribution de tokens.\n\nVeuillez d'abord indiquer l'ID du token à distribuer (format: 0.0.X):"
    : "You are going to create a token distribution campaign.\n\nPlease provide the token ID to distribute (format: 0.0.X):";
    
  await bot.sendMessage(chatId, message);
}

/**
 * Gestionnaire de la commande /claim
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleClaim(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  
  // Initialiser l'état de l'utilisateur
  userState.set(userId, {
    state: CLAIM_STATES.WAITING_FOR_CAMPAIGN_ID
  });
  
  // Récupérer les campagnes actives
  const campaigns = getActiveCampaigns();
  
  if (!campaigns || campaigns.length === 0) {
    const message = userLang === 'fr' 
      ? "Il n'y a actuellement aucune campagne active à laquelle vous pouvez participer."
      : "There are currently no active campaigns you can participate in.";
      
    await bot.sendMessage(chatId, message);
    userState.delete(userId);
    return;
  }
  
  // Créer une liste des campagnes actives
  let campaignList = '';
  campaigns.forEach((campaign, index) => {
    campaignList += `${index + 1}. ${campaign.name} (ID: ${campaign.id})\n   ${campaign.tokenId} - ${campaign.amountPerUser} tokens par utilisateur\n\n`;
  });
  
  const message = userLang === 'fr' 
    ? `Voici les campagnes actives :\n\n${campaignList}\nVeuillez indiquer l'ID de la campagne à laquelle vous souhaitez participer:`
    : `Here are the active campaigns:\n\n${campaignList}\nPlease provide the ID of the campaign you want to participate in:`;
    
  await bot.sendMessage(chatId, message);
}

/**
 * Gestionnaire de la commande /mycampaigns
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleMyCampaigns(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  
  // Récupérer les campagnes de l'utilisateur
  const campaigns = getUserCampaigns(userId);
  
  if (!campaigns || campaigns.length === 0) {
    const message = userLang === 'fr' 
      ? "Vous n'avez créé aucune campagne pour le moment."
      : "You haven't created any campaigns yet.";
      
    await bot.sendMessage(chatId, message);
    return;
  }
  
  // Créer une liste des campagnes de l'utilisateur
  let campaignList = '';
  campaigns.forEach((campaign, index) => {
    const status = campaign.status === 'active' 
      ? (userLang === 'fr' ? '✅ Active' : '✅ Active')
      : campaign.status === 'paused' 
        ? (userLang === 'fr' ? '⏸️ En pause' : '⏸️ Paused')
        : campaign.status === 'completed' 
          ? (userLang === 'fr' ? '✓ Terminée' : '✓ Completed')
          : (userLang === 'fr' ? '❌ Annulée' : '❌ Cancelled');
          
    campaignList += `${index + 1}. ${campaign.name} (ID: ${campaign.id}) - ${status}\n   ${campaign.tokenId} - ${campaign.claimedAmount}/${campaign.totalAmount} tokens distribués\n\n`;
  });
  
  let instructions = userLang === 'fr'
    ? "Pour modifier le statut d'une campagne, utilisez la commande /campaignstatus suivi de l'ID de la campagne."
    : "To change a campaign's status, use the /campaignstatus command followed by the campaign ID.";
  
  const message = userLang === 'fr' 
    ? `Vos campagnes :\n\n${campaignList}\n${instructions}`
    : `Your campaigns:\n\n${campaignList}\n${instructions}`;
    
  await bot.sendMessage(chatId, message);
}

/**
 * Gestionnaire de la commande /campaigninfo
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleCampaignInfo(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  const args = msg.text.split(' ');
  
  if (args.length < 2) {
    const message = userLang === 'fr' 
      ? "Veuillez fournir l'ID de la campagne. Exemple: /campaigninfo CAMPAIGN_ID"
      : "Please provide the campaign ID. Example: /campaigninfo CAMPAIGN_ID";
      
    await bot.sendMessage(chatId, message);
    return;
  }
  
  const campaignId = args[1].trim();
  const campaign = getCampaign(campaignId);
  
  if (!campaign) {
    const message = userLang === 'fr' 
      ? `Aucune campagne trouvée avec l'ID ${campaignId}`
      : `No campaign found with ID ${campaignId}`;
      
    await bot.sendMessage(chatId, message);
    return;
  }
  
  const status = campaign.status === 'active' 
    ? (userLang === 'fr' ? '✅ Active' : '✅ Active')
    : campaign.status === 'paused' 
      ? (userLang === 'fr' ? '⏸️ En pause' : '⏸️ Paused')
      : campaign.status === 'completed' 
        ? (userLang === 'fr' ? '✓ Terminée' : '✓ Completed')
        : (userLang === 'fr' ? '❌ Annulée' : '❌ Cancelled');
        
  const createdDate = new Date(campaign.createdAt).toLocaleDateString();
  const endDate = new Date(campaign.endDate).toLocaleDateString();
  
  const detailsMessage = userLang === 'fr'
    ? `📊 *Détails de la campagne:*\n\n`
      + `*Nom:* ${campaign.name}\n`
      + `*ID:* ${campaign.id}\n`
      + `*Description:* ${campaign.description}\n`
      + `*Token:* ${campaign.tokenId}\n`
      + `*Montant par utilisateur:* ${campaign.amountPerUser}\n`
      + `*Total distribué:* ${campaign.claimedAmount}/${campaign.totalAmount}\n`
      + `*Participants:* ${campaign.participants.length}\n`
      + `*Statut:* ${status}\n`
      + `*Créé le:* ${createdDate}\n`
      + `*Date de fin:* ${endDate}\n`
    : `📊 *Campaign Details:*\n\n`
      + `*Name:* ${campaign.name}\n`
      + `*ID:* ${campaign.id}\n`
      + `*Description:* ${campaign.description}\n`
      + `*Token:* ${campaign.tokenId}\n`
      + `*Amount per user:* ${campaign.amountPerUser}\n`
      + `*Total distributed:* ${campaign.claimedAmount}/${campaign.totalAmount}\n`
      + `*Participants:* ${campaign.participants.length}\n`
      + `*Status:* ${status}\n`
      + `*Created on:* ${createdDate}\n`
      + `*End date:* ${endDate}\n`;
      
  await bot.sendMessage(chatId, detailsMessage, { parse_mode: 'Markdown' });
}

/**
 * Gestionnaire de la commande /campaignstatus
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleCampaignStatus(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  const args = msg.text.split(' ');
  
  if (args.length < 2) {
    const message = userLang === 'fr' 
      ? "Veuillez fournir l'ID de la campagne. Exemple: /campaignstatus CAMPAIGN_ID"
      : "Please provide the campaign ID. Example: /campaignstatus CAMPAIGN_ID";
      
    await bot.sendMessage(chatId, message);
    return;
  }
  
  const campaignId = args[1].trim();
  const campaign = getCampaign(campaignId);
  
  if (!campaign) {
    const message = userLang === 'fr' 
      ? `Aucune campagne trouvée avec l'ID ${campaignId}`
      : `No campaign found with ID ${campaignId}`;
      
    await bot.sendMessage(chatId, message);
    return;
  }
  
  // Vérifier que l'utilisateur est bien le créateur de la campagne
  if (campaign.creatorId !== userId) {
    const message = userLang === 'fr' 
      ? "Vous n'êtes pas autorisé à modifier le statut de cette campagne."
      : "You are not authorized to change the status of this campaign.";
      
    await bot.sendMessage(chatId, message);
    return;
  }
  
  // Options de statut
  const statusOptions = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: userLang === 'fr' ? '✅ Activer' : '✅ Activate', callback_data: `status_${campaignId}_active` },
          { text: userLang === 'fr' ? '⏸️ Mettre en pause' : '⏸️ Pause', callback_data: `status_${campaignId}_paused` }
        ],
        [
          { text: userLang === 'fr' ? '✓ Terminer' : '✓ Complete', callback_data: `status_${campaignId}_completed` },
          { text: userLang === 'fr' ? '❌ Annuler' : '❌ Cancel', callback_data: `status_${campaignId}_cancelled` }
        ]
      ]
    }
  };
  
  const message = userLang === 'fr' 
    ? `Veuillez choisir le nouveau statut pour la campagne "${campaign.name}":`
    : `Please select the new status for the campaign "${campaign.name}":`;
    
  await bot.sendMessage(chatId, message, statusOptions);
}

/**
 * Gestionnaire de la commande /claimairdrop
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 */
async function handleClaimAirdrop(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  
  // Récupérer les airdrops disponibles pour cet utilisateur
  const { getAvailableAirdrops } = require('../hedera/airdrop');
  const availableAirdrops = await getAvailableAirdrops(userId);
  
  console.log(`Airdrops disponibles pour ${userId}:`, availableAirdrops);
  
  // Vérifier s'il y a des airdrops disponibles
  if (availableAirdrops && availableAirdrops.length > 0) {
    // Afficher la liste des airdrops disponibles avec boutons d'action
    let airdropsList = '';
    availableAirdrops.forEach((airdrop, index) => {
      // Afficher plus d'informations sur l'airdrop, y compris le symbole et le treasury si disponibles
      let airdropInfo = `${index + 1}. ${airdrop.tokenName || 'Token'}`;
      
      if (airdrop.tokenSymbol) {
        airdropInfo += ` (${airdrop.tokenSymbol})`;
      }
      
      airdropInfo += ` (ID: ${airdrop.id})\n   ${airdrop.amount || 'Unknown'} tokens`;
      
      if (airdrop.treasuryId) {
        airdropInfo += `\n   Treasury: ${airdrop.treasuryId}`;
      }
      
      if (airdrop.createdAt) {
        const createdDate = new Date(airdrop.createdAt);
        airdropInfo += `\n   ${userLang === 'fr' ? 'Créé le' : 'Created on'}: ${createdDate.toLocaleString()}`;
      }
      
      airdropsList += airdropInfo + '\n\n';
    });
    
    // Créer des boutons pour chaque airdrop
    const inlineKeyboard = availableAirdrops.map((airdrop, index) => [
      { 
        text: userLang === 'fr' 
          ? `Réclamer ${airdrop.tokenName || 'Token'} (${airdrop.amount} tokens)` 
          : `Claim ${airdrop.tokenName || 'Token'} (${airdrop.amount} tokens)`,
        callback_data: `claim_airdrop_${airdrop.id}` 
      }
    ]);
    
    const message = userLang === 'fr' 
      ? `Voici les airdrops disponibles pour votre compte:\n\n${airdropsList}\nCliquez sur le bouton correspondant pour réclamer un airdrop, ou entrez manuellement l'ID d'un airdrop:`
      : `Here are the available airdrops for your account:\n\n${airdropsList}\nClick on the corresponding button to claim an airdrop, or manually enter an airdrop ID:`;
      
    // Initialiser l'état de l'utilisateur
    userState.set(userId, {
      state: CLAIM_STATES.WAITING_FOR_AIRDROP_ID,
      availableAirdrops: availableAirdrops
    });
    
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
  } else {
    // Pas d'airdrops disponibles connus, demander directement l'ID
    // Initialiser l'état de l'utilisateur
    userState.set(userId, {
      state: CLAIM_STATES.WAITING_FOR_AIRDROP_ID
    });
    
    const message = userLang === 'fr' 
      ? "Aucun airdrop en attente trouvé pour votre compte.\n\nSi vous avez un ID d'airdrop spécifique à réclamer, veuillez le fournir ci-dessous. Cet ID vous a été communiqué par l'expéditeur de l'airdrop:"
      : "No pending airdrops found for your account.\n\nIf you have a specific airdrop ID to claim, please provide it below. This ID was communicated to you by the sender of the airdrop:";
      
    await bot.sendMessage(chatId, message);
  }
}

/**
 * Gestionnaire des conversations pour les airdrops et campagnes
 * @param {Object} bot - Instance du bot Telegram
 * @param {Object} msg - Message Telegram
 * @returns {boolean} true si le message a été traité, false sinon
 */
async function handleAirdropConversation(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userLang = getUserLanguage(userId);
  const userInfo = userState.get(userId);
  
  if (!userInfo || !userInfo.state) {
    return false;
  }
  
  // Traitement des différents états de conversation
  // Gestion des airdrops
  if (userInfo.state === AIRDROP_STATES.WAITING_FOR_TOKEN_ID) {
    const tokenId = msg.text.trim();
    userInfo.airdropInfo.tokenId = tokenId;
    userInfo.state = AIRDROP_STATES.WAITING_FOR_RECIPIENT_ID;
    
    const message = userLang === 'fr'
      ? "Veuillez fournir les IDs des destinataires (format: 0.0.X pour les comptes Hedera ou l'ID numérique Telegram, @nom_utilisateur ou simplement le nom d'utilisateur).\n\nVous pouvez spécifier plusieurs destinataires en les séparant par des virgules.\n\nExemple: 0.0.1234, @utilisateur1, utilisateur2"
      : "Please provide the recipient IDs (format: 0.0.X for Hedera accounts or the numerical Telegram ID, @username or just username).\n\nYou can specify multiple recipients by separating them with commas.\n\nExample: 0.0.1234, @user1, user2";
      
    await bot.sendMessage(chatId, message);
    return true;
  }
  
  if (userInfo.state === AIRDROP_STATES.WAITING_FOR_RECIPIENT_ID) {
    const recipientsInput = msg.text.trim();
    
    // Initialiser la liste des destinataires s'ils n'existent pas encore
    if (!userInfo.airdropInfo.recipientsResolved) {
      userInfo.airdropInfo.recipientsResolved = [];
    }
    
    // Résoudre tous les identifiants (Telegram ou Hedera)
    const { resolveIdentifiersList } = require('../hedera/airdrop');
    const resolvedRecipients = await resolveIdentifiersList(recipientsInput);
    
    // Vérifier si tous les identifiants ont été résolus
    const unresolved = resolvedRecipients.filter(r => r.accountId === null);
    if (unresolved.length > 0) {
      const unresolvedIds = unresolved.map(r => r.id).join(', ');
      const errorMsg = userLang === 'fr'
        ? `Impossible de résoudre les identifiants suivants: ${unresolvedIds}.\n\n⚠️ Ces utilisateurs n'ont pas encore créé de portefeuille Hedera. Pour recevoir un airdrop, chaque utilisateur doit d'abord utiliser la commande /createwallet.\n\nVeuillez vérifier les identifiants ou demander aux utilisateurs de créer leur portefeuille avant de réessayer.`
        : `Unable to resolve the following identifiers: ${unresolvedIds}.\n\n⚠️ These users haven't created a Hedera wallet yet. To receive an airdrop, each user must first use the /createwallet command.\n\nPlease check the identifiers or ask users to create their wallet before trying again.`;
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    // Stocker les destinataires résolus
    userInfo.airdropInfo.recipientsResolved = resolvedRecipients.map(r => ({ 
      originalId: r.id,
      accountId: r.accountId 
    }));
    
    // Si plusieurs destinataires, demander un montant pour tous
    if (resolvedRecipients.length > 1) {
      userInfo.state = AIRDROP_STATES.WAITING_FOR_AMOUNT;
      const recipientCount = resolvedRecipients.length;
      
      const message = userLang === 'fr'
        ? `${recipientCount} destinataires identifiés. Veuillez indiquer le montant de tokens à envoyer à chaque destinataire:`
        : `${recipientCount} recipients identified. Please specify the amount of tokens to send to each recipient:`;
        
      await bot.sendMessage(chatId, message);
    } else if (resolvedRecipients.length === 1) {
      // Un seul destinataire
      userInfo.state = AIRDROP_STATES.WAITING_FOR_AMOUNT;
      const message = userLang === 'fr'
        ? "Veuillez indiquer le montant de tokens à envoyer à ce destinataire:"
        : "Please specify the amount of tokens to send to this recipient:";
        
      await bot.sendMessage(chatId, message);
    } else {
      // Aucun destinataire résolu (ne devrait pas arriver à cause de la vérification ci-dessus)
      const errorMsg = userLang === 'fr'
        ? "Aucun destinataire valide n'a été trouvé. Veuillez réessayer."
        : "No valid recipients were found. Please try again.";
        
      await bot.sendMessage(chatId, errorMsg);
    }
    
    return true;
  }
  
  if (userInfo.state === AIRDROP_STATES.WAITING_FOR_AMOUNT) {
    const amount = parseFloat(msg.text.trim());
    
    if (isNaN(amount) || amount <= 0) {
      const errorMsg = userLang === 'fr'
        ? "Montant invalide. Veuillez entrer un nombre positif."
        : "Invalid amount. Please enter a positive number.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    // Créer la liste des destinataires avec le montant spécifié
    userInfo.airdropInfo.recipients = [];
    
    // Utiliser les destinataires résolus (format ID Telegram ou Hedera)
    if (userInfo.airdropInfo.recipientsResolved && userInfo.airdropInfo.recipientsResolved.length > 0) {
      userInfo.airdropInfo.recipients = userInfo.airdropInfo.recipientsResolved.map(r => ({
        originalId: r.originalId,
        accountId: r.accountId,
        amount: amount
      }));
    } 
    // Fallback pour l'ancienne méthode si nécessaire
    else if (userInfo.currentRecipient) {
      userInfo.currentRecipient.amount = amount;
      userInfo.airdropInfo.recipients.push(userInfo.currentRecipient);
    }
    
    // Préparer la liste des destinataires pour l'affichage
    const recipientsList = userInfo.airdropInfo.recipients.map((r, i) => {
      // Afficher à la fois l'ID original et l'ID du compte Hedera si différents
      const idDisplay = r.originalId && r.originalId !== r.accountId 
        ? `${r.originalId} (${r.accountId})` 
        : r.accountId;
        
      return `${i+1}. ${idDisplay} - ${r.amount} tokens`;
    }).join('\n');
    
    // Options pour ajouter un autre destinataire ou finaliser
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: userLang === 'fr' ? "➕ Ajouter d'autres destinataires" : "➕ Add more recipients", 
              callback_data: "airdrop_add_recipient" 
            }
          ],
          [
            { 
              text: userLang === 'fr' ? "✅ Finaliser l'airdrop" : "✅ Finalize airdrop", 
              callback_data: "airdrop_finalize" 
            }
          ]
        ]
      }
    };
    
    const message = userLang === 'fr'
      ? `Destinataire(s) ajouté(s) avec succès.\n\nDestinaires actuels:\n${recipientsList}\n\nQue souhaitez-vous faire ?`
      : `Recipient(s) added successfully.\n\nCurrent recipients:\n${recipientsList}\n\nWhat would you like to do?`;
      
    await bot.sendMessage(chatId, message, options);
    return true;
  }
  
  // Gestion des campagnes
  if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_TOKEN_ID) {
    const tokenId = msg.text.trim();
    userInfo.campaignInfo.tokenId = tokenId;
    userInfo.state = CAMPAIGN_STATES.WAITING_FOR_NAME;
    
    const message = userLang === 'fr'
      ? "Veuillez indiquer le nom de votre campagne:"
      : "Please provide a name for your campaign:";
      
    await bot.sendMessage(chatId, message);
    return true;
  }
  
  if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_NAME) {
    const name = msg.text.trim();
    userInfo.campaignInfo.name = name;
    userInfo.state = CAMPAIGN_STATES.WAITING_FOR_DESCRIPTION;
    
    const message = userLang === 'fr'
      ? "Veuillez fournir une description pour votre campagne:"
      : "Please provide a description for your campaign:";
      
    await bot.sendMessage(chatId, message);
    return true;
  }
  
  if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_DESCRIPTION) {
    const description = msg.text.trim();
    userInfo.campaignInfo.description = description;
    userInfo.state = CAMPAIGN_STATES.WAITING_FOR_AMOUNT_PER_USER;
    
    const message = userLang === 'fr'
      ? "Veuillez indiquer le montant de tokens par utilisateur:"
      : "Please specify the amount of tokens per user:";
      
    await bot.sendMessage(chatId, message);
    return true;
  }
  
  if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_AMOUNT_PER_USER) {
    const amountPerUser = parseFloat(msg.text.trim());
    
    if (isNaN(amountPerUser) || amountPerUser <= 0) {
      const errorMsg = userLang === 'fr'
        ? "Montant invalide. Veuillez entrer un nombre positif."
        : "Invalid amount. Please enter a positive number.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    userInfo.campaignInfo.amountPerUser = amountPerUser;
    userInfo.state = CAMPAIGN_STATES.WAITING_FOR_TOTAL_AMOUNT;
    
    const message = userLang === 'fr'
      ? "Veuillez indiquer le montant total de tokens pour cette campagne:"
      : "Please specify the total amount of tokens for this campaign:";
      
    await bot.sendMessage(chatId, message);
    return true;
  }
  
  if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_TOTAL_AMOUNT) {
    const totalAmount = parseFloat(msg.text.trim());
    
    if (isNaN(totalAmount) || totalAmount <= 0) {
      const errorMsg = userLang === 'fr'
        ? "Montant invalide. Veuillez entrer un nombre positif."
        : "Invalid amount. Please enter a positive number.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    if (totalAmount < userInfo.campaignInfo.amountPerUser) {
      const errorMsg = userLang === 'fr'
        ? "Le montant total doit être supérieur au montant par utilisateur."
        : "Total amount must be greater than the amount per user.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    userInfo.campaignInfo.totalAmount = totalAmount;
    userInfo.state = CAMPAIGN_STATES.WAITING_FOR_END_DATE;
    
    const message = userLang === 'fr'
      ? "Veuillez indiquer la date de fin de la campagne (format: YYYY-MM-DD):"
      : "Please specify the end date for the campaign (format: YYYY-MM-DD):";
      
    await bot.sendMessage(chatId, message);
    return true;
  }
  
  if (userInfo.state === CAMPAIGN_STATES.WAITING_FOR_END_DATE) {
    const endDateStr = msg.text.trim();
    const endDate = new Date(endDateStr);
    
    if (isNaN(endDate.getTime()) || endDate <= new Date()) {
      const errorMsg = userLang === 'fr'
        ? "Date invalide. Veuillez entrer une date future au format YYYY-MM-DD."
        : "Invalid date. Please enter a future date in the format YYYY-MM-DD.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    userInfo.campaignInfo.endDate = endDate.toISOString();
    userInfo.state = CAMPAIGN_STATES.WAITING_FOR_CONFIRMATION;
    
    // Résumé de la campagne
    const summary = userLang === 'fr'
      ? `📝 *Résumé de votre campagne:*\n\n`
        + `*Nom:* ${userInfo.campaignInfo.name}\n`
        + `*Description:* ${userInfo.campaignInfo.description}\n`
        + `*Token:* ${userInfo.campaignInfo.tokenId}\n`
        + `*Montant par utilisateur:* ${userInfo.campaignInfo.amountPerUser}\n`
        + `*Montant total:* ${userInfo.campaignInfo.totalAmount}\n`
        + `*Date de fin:* ${new Date(userInfo.campaignInfo.endDate).toLocaleDateString()}\n\n`
        + `Veuillez confirmer la création de cette campagne.`
      : `📝 *Campaign summary:*\n\n`
        + `*Name:* ${userInfo.campaignInfo.name}\n`
        + `*Description:* ${userInfo.campaignInfo.description}\n`
        + `*Token:* ${userInfo.campaignInfo.tokenId}\n`
        + `*Amount per user:* ${userInfo.campaignInfo.amountPerUser}\n`
        + `*Total amount:* ${userInfo.campaignInfo.totalAmount}\n`
        + `*End date:* ${new Date(userInfo.campaignInfo.endDate).toLocaleDateString()}\n\n`
        + `Please confirm the creation of this campaign.`;
        
    // Options de confirmation
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: userLang === 'fr' ? "✅ Confirmer" : "✅ Confirm", 
              callback_data: "campaign_confirm" 
            },
            { 
              text: userLang === 'fr' ? "❌ Annuler" : "❌ Cancel", 
              callback_data: "campaign_cancel" 
            }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, summary, options);
    return true;
  }
  
  // Gestion des réclamations
  if (userInfo.state === CLAIM_STATES.WAITING_FOR_CAMPAIGN_ID) {
    const campaignId = msg.text.trim();
    
    // Vérifier si la campagne existe
    const campaign = getCampaign(campaignId);
    
    if (!campaign) {
      const errorMsg = userLang === 'fr'
        ? `Aucune campagne trouvée avec l'ID ${campaignId}`
        : `No campaign found with ID ${campaignId}`;
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    // Vérifier si la campagne est active
    if (campaign.status !== 'active') {
      const errorMsg = userLang === 'fr'
        ? "Cette campagne n'est pas active actuellement."
        : "This campaign is not currently active.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    // Vérifier si l'utilisateur a déjà réclamé des tokens
    if (campaign.participants.includes(userId)) {
      const errorMsg = userLang === 'fr'
        ? "Vous avez déjà réclamé des tokens de cette campagne."
        : "You have already claimed tokens from this campaign.";
        
      await bot.sendMessage(chatId, errorMsg);
      return true;
    }
    
    // Procéder à la réclamation
    await bot.sendMessage(chatId, 
      userLang === 'fr' 
        ? "Traitement de votre demande en cours..."
        : "Processing your request...");
    
    const result = await claimFromCampaign(userId, campaignId);
    
    if (result.success) {
      const message = userLang === 'fr'
        ? `✅ Félicitations! Vous avez reçu ${campaign.amountPerUser} tokens (${campaign.tokenId}) de la campagne "${campaign.name}".\n\n`
          + `ID de transaction: ${result.transactionId}\n`
          + `Explorer: ${result.explorerUrl || 'N/A'}\n`
          + `HashScan: ${result.hashscanUrl || 'N/A'}`
        : `✅ Congratulations! You have received ${campaign.amountPerUser} tokens (${campaign.tokenId}) from the "${campaign.name}" campaign.\n\n`
          + `Transaction ID: ${result.transactionId}\n`
          + `Explorer: ${result.explorerUrl || 'N/A'}\n`
          + `HashScan: ${result.hashscanUrl || 'N/A'}`;
          
      await bot.sendMessage(chatId, message);
    } else {
      const message = userLang === 'fr'
        ? `❌ Erreur lors de la réclamation: ${result.message}`
        : `❌ Error during claim: ${result.message}`;
        
      await bot.sendMessage(chatId, message);
    }
    
    // Réinitialiser l'état
    userState.delete(userId);
    return true;
  }
  
  if (userInfo.state === CLAIM_STATES.WAITING_FOR_AIRDROP_ID) {
    const airdropId = msg.text.trim();
    
    // Procéder à la réclamation
    await bot.sendMessage(chatId, 
      userLang === 'fr' 
        ? "Traitement de votre réclamation d'airdrop en cours..."
        : "Processing your airdrop claim...");
    
    // Vérifier si nous utilisons un ID de base de données
    const isDbId = userInfo.availableAirdrops && userInfo.availableAirdrops.length > 0;
    
    // Procéder à la réclamation
    const result = await claimTokenAirdrop(userId, airdropId, isDbId);
    
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
          
      await bot.sendMessage(chatId, message);
    } else {
      const message = userLang === 'fr'
        ? `❌ Erreur lors de la réclamation de l'airdrop: ${result.message}`
        : `❌ Error during airdrop claim: ${result.message}`;
        
      await bot.sendMessage(chatId, message);
    }
    
    // Réinitialiser l'état
    userState.delete(userId);
    return true;
  }
  
  return false;
}

/**
 * Initialise le module avec l'état partagé des utilisateurs
 * @param {Map} sharedUserState - Map d'état des utilisateurs partagée
 */
function initializeWithSharedState(sharedUserState) {
  userState = sharedUserState;
  console.log('État des utilisateurs partagé initialisé dans airdrop-commands.js');
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
  initializeWithSharedState,
  userState // Exporter l'état des utilisateurs pour les gestionnaires de callback
};