/**
 * Gestionnaire des commandes de programme de fidélité pour le bot Telegram
 */

const {
  createLoyaltyProgram,
  getUserLoyaltyPrograms,
  getAllLoyaltyPrograms,
  analyzeReceipt,
  calculatePoints,
  awardLoyaltyPoints
} = require('../loyalty/loyalty-program');

const { LOYALTY_STATES } = require('../loyalty/loyalty-states');
const { getWalletByUserId } = require('../storage/userWallets');
const { explorerUrl } = require('../utils/explorer');

// État des utilisateurs partagé
let sharedUserState = null;

/**
 * Initialiser l'état des utilisateurs partagé
 * @param {Map} userState - État des utilisateurs partagé
 */
function initializeSharedUserState(userState) {
  sharedUserState = userState;
  console.log('État des utilisateurs partagé initialisé dans loyalty-commands.js');
}

/**
 * Gérer la commande de création de programme de fidélité
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Message Telegram
 */
async function handleCreateLoyaltyProgram(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Vérifier si l'utilisateur a un portefeuille
  const wallet = await getWalletByUserId(userId);
  if (!wallet) {
    await bot.sendMessage(
      chatId,
      "Vous devez d'abord créer un portefeuille avec la commande /createwallet avant de pouvoir créer un programme de fidélité."
    );
    return;
  }
  
  // Initialiser l'état de la conversation
  sharedUserState.set(userId, {
    state: LOYALTY_STATES.WAITING_FOR_PROGRAM_NAME,
    chatId: chatId,
    loyalty: {}
  });
  
  // Demander le nom du programme
  await bot.sendMessage(
    chatId,
    "Entrez un nom pour votre programme de fidélité (par exemple: 'Programme Fidélité Boutique'):",
    { reply_markup: { force_reply: true } }
  );
}

/**
 * Gérer la commande pour gagner des points de fidélité
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Message Telegram
 */
async function handleEarnPoints(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Vérifier si l'utilisateur a un portefeuille
  const wallet = await getWalletByUserId(userId);
  if (!wallet) {
    await bot.sendMessage(
      chatId,
      "Vous devez d'abord créer un portefeuille avec la commande /createwallet avant de pouvoir gagner des points de fidélité."
    );
    return;
  }
  
  // Récupérer tous les programmes de fidélité disponibles
  const programs = await getAllLoyaltyPrograms();
  
  if (programs.length === 0) {
    await bot.sendMessage(
      chatId,
      "Aucun programme de fidélité n'est disponible actuellement. Utilisez /createloyalty pour en créer un."
    );
    return;
  }
  
  // Créer un clavier inline avec les programmes disponibles
  const keyboard = programs.map(program => [
    {
      text: `${program.program_name} (${program.token_id})`,
      callback_data: `loyalty_select_${program.token_id}`
    }
  ]);
  
  // Initialiser l'état de la conversation
  sharedUserState.set(userId, {
    state: LOYALTY_STATES.WAITING_FOR_PROGRAM_SELECTION,
    chatId: chatId,
    loyalty: {}
  });
  
  // Afficher le menu de sélection
  await bot.sendMessage(
    chatId,
    "Sélectionnez un programme de fidélité pour gagner des points:",
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

/**
 * Gérer les entrées utilisateur pour les programmes de fidélité
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Message Telegram
 * @returns {boolean} Vrai si l'entrée a été gérée, faux sinon
 */
async function handleLoyaltyInput(bot, msg) {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const userInfo = sharedUserState.get(userId);
  
  if (!userInfo || !Object.values(LOYALTY_STATES).includes(userInfo.state)) {
    return false;
  }
  
  switch (userInfo.state) {
    case LOYALTY_STATES.WAITING_FOR_PROGRAM_NAME:
      if (!text) return false;
      
      // Enregistrer le nom du programme
      userInfo.loyalty.programName = text;
      userInfo.state = LOYALTY_STATES.WAITING_FOR_SUPPLY;
      sharedUserState.set(userId, userInfo);
      
      // Demander la quantité de points
      await bot.sendMessage(
        chatId,
        "Combien de points de fidélité souhaitez-vous créer initialement? (entre 1 et 100 000 000)",
        { reply_markup: { force_reply: true } }
      );
      return true;
      
    case LOYALTY_STATES.WAITING_FOR_SUPPLY:
      if (!text) return false;
      
      // Valider la quantité de points
      const supply = parseInt(text);
      if (isNaN(supply) || supply <= 0 || supply > 100000000) {
        await bot.sendMessage(
          chatId,
          "La quantité doit être un nombre entier positif entre 1 et 100 000 000. Veuillez réessayer:",
          { reply_markup: { force_reply: true } }
        );
        return true;
      }
      
      // Créer le programme de fidélité
      await bot.sendMessage(chatId, "Création du programme de fidélité en cours...");
      
      const result = await createLoyaltyProgram(
        userId, 
        userInfo.loyalty.programName, 
        supply
      );
      
      if (result.success) {
        const message = `
✅ ${result.message}

*Détails du programme:*
Nom: \`${result.programName}\`
Token ID: \`${result.tokenId}\`

[Voir dans l'explorateur](${result.explorerUrl})

Utilisez /earnpoints pour commencer à gagner des points en scannant des factures.
`;
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, `❌ ${result.message}`);
      }
      
      // Réinitialiser l'état
      sharedUserState.set(userId, { state: LOYALTY_STATES.NONE });
      return true;
      
    default:
      return false;
  }
}

/**
 * Gérer la réception d'une photo pour l'analyse de facture
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Message Telegram
 * @returns {boolean} Vrai si la photo a été gérée, faux sinon
 */
async function handleReceiptPhoto(bot, msg) {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;
  const userInfo = sharedUserState.get(userId);
  
  // Vérifier si l'utilisateur est en train d'attendre une photo de facture
  if (!userInfo || userInfo.state !== LOYALTY_STATES.WAITING_FOR_PHOTO) {
    return false;
  }
  
  // Récupérer l'ID du fichier de la photo (la plus grande résolution disponible)
  const photoId = msg.photo[msg.photo.length - 1].file_id;
  const programId = userInfo.loyalty.selectedProgramId;
  
  await bot.sendMessage(chatId, "Analyse de la facture en cours... Cela peut prendre quelques instants.");
  
  try {
    // Télécharger la photo
    const fileLink = await bot.getFileLink(photoId);
    const response = await fetch(fileLink);
    const buffer = await response.arrayBuffer();
    
    // Convertir en base64
    const base64Image = Buffer.from(buffer).toString('base64');
    
    // Analyser la facture avec GPT-4V
    const analysisResult = await analyzeReceipt(base64Image);
    
    if (!analysisResult.success) {
      await bot.sendMessage(
        chatId, 
        `❌ Erreur lors de l'analyse de la facture: ${analysisResult.message}`
      );
      sharedUserState.set(userId, { state: LOYALTY_STATES.NONE });
      return true;
    }
    
    // Extraire le montant total
    const { data } = analysisResult;
    const store = data.nom_du_magasin || data.store || data.magasin || "Non identifié";
    const date = data.date || "Non identifiée";
    const totalAmount = parseFloat(data.montant_total || data.total_amount || data.total || "0");
    
    if (isNaN(totalAmount) || totalAmount <= 0) {
      await bot.sendMessage(
        chatId,
        "❌ Impossible de détecter un montant valide sur cette facture. Veuillez réessayer avec une image plus claire."
      );
      sharedUserState.set(userId, { state: LOYALTY_STATES.NONE });
      return true;
    }
    
    // Calculer les points à attribuer (0.25 point par unité monétaire)
    const pointsToAward = calculatePoints(totalAmount);
    
    await bot.sendMessage(
      chatId,
      `✅ Facture analysée avec succès!

*Détails de la facture:*
• Magasin: ${store}
• Date: ${date}
• Montant total: ${totalAmount.toFixed(2)} €

Vous allez recevoir ${pointsToAward} points de fidélité.

Attribution des points en cours...`,
      { parse_mode: 'Markdown' }
    );
    
    // Attribuer les points
    const awardResult = await awardLoyaltyPoints(userId, programId, pointsToAward);
    
    if (awardResult.success) {
      const message = `
✅ ${awardResult.message}

*Détails:*
Programme: \`${awardResult.programName}\`
Token ID: \`${awardResult.tokenId}\`
Points ajoutés: ${awardResult.amount}

[Voir la transaction dans l'explorateur](${awardResult.explorerUrl})

Merci pour votre achat !
`;
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, `❌ ${awardResult.message}`);
    }
    
    // Réinitialiser l'état
    sharedUserState.set(userId, { state: LOYALTY_STATES.NONE });
    return true;
  } catch (error) {
    console.error('Erreur lors du traitement de la photo:', error);
    await bot.sendMessage(
      chatId,
      `❌ Une erreur s'est produite lors du traitement de la photo: ${error.message}`
    );
    sharedUserState.set(userId, { state: LOYALTY_STATES.NONE });
    return true;
  }
}

module.exports = {
  initializeSharedUserState,
  handleCreateLoyaltyProgram,
  handleEarnPoints,
  handleLoyaltyInput,
  handleReceiptPhoto,
  LOYALTY_STATES
};
