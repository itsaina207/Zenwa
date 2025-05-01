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
const { translate } = require('./language/handler');

// États pour les conversations de fidélité
const LOYALTY_STATES = {
  IDLE: 'idle',
  WAITING_FOR_PROGRAM_NAME: 'waiting_for_program_name',
  WAITING_FOR_PROGRAM_SUPPLY: 'waiting_for_program_supply',
  WAITING_FOR_PROGRAM_SELECTION: 'waiting_for_program_selection',
  WAITING_FOR_RECEIPT: 'waiting_for_receipt'
};

// État de conversation pour chaque utilisateur
let userState = new Map();

/**
 * Initialiser l'état des utilisateurs partagé
 * @param {Map} sharedUserState - État des utilisateurs partagé
 */
function initializeSharedUserState(sharedUserState) {
  userState = sharedUserState;
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
  
  // Initialiser l'état utilisateur si nécessaire
  if (!userState.has(userId)) {
    userState.set(userId, { chatId });
  }
  
  const userInfo = userState.get(userId);
  
  // Demander le nom du programme
  userInfo.state = LOYALTY_STATES.WAITING_FOR_PROGRAM_NAME;
  userState.set(userId, userInfo);
  
  await bot.sendMessage(
    chatId,
    'Création d\'un programme de fidélité 🏆\n\nVeuillez entrer le nom de votre programme de fidélité:',
    { parse_mode: 'Markdown' }
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
  
  // Initialiser l'état utilisateur si nécessaire
  if (!userState.has(userId)) {
    userState.set(userId, { chatId });
  }
  
  const userInfo = userState.get(userId);
  
  // Récupérer tous les programmes de fidélité
  const programs = await getAllLoyaltyPrograms();
  
  if (programs.length === 0) {
    await bot.sendMessage(
      chatId,
      "Aucun programme de fidélité n'est disponible actuellement. Utilisez /createloyalty pour en créer un."
    );
    return;
  }
  
  // Préparer les boutons pour sélectionner un programme
  const keyboard = [];
  programs.forEach(program => {
    keyboard.push([{ text: `${program.name} (${program.token_id})` }]);
  });
  
  // Ajouter un bouton d'annulation
  keyboard.push([{ text: 'Annuler' }]);
  
  userInfo.programs = programs;
  userInfo.state = LOYALTY_STATES.WAITING_FOR_PROGRAM_SELECTION;
  userState.set(userId, userInfo);
  
  await bot.sendMessage(
    chatId,
    'Gagner des points de fidélité 🎁\n\nVeuillez sélectionner un programme de fidélité:',
    {
      reply_markup: {
        keyboard,
        one_time_keyboard: true,
        resize_keyboard: true
      }
    }
  );
}

/**
 * Gérer les entrées utilisateur pour les programmes de fidélité
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Message Telegram
 * @returns {boolean} Vrai si l'entrée a été gérée, faux sinon
 */
async function handleLoyaltyInput(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;
  
  // Si l'utilisateur n'a pas d'état ou est dans un état non lié à la fidélité, ignorer
  if (!userState.has(userId)) return false;
  
  const userInfo = userState.get(userId);
  
  // Si pas dans un état de conversation lié à la fidélité, ignorer
  if (!userInfo.state || !Object.values(LOYALTY_STATES).includes(userInfo.state)) {
    return false;
  }
  
  // Gérer l'annulation
  if (text === 'Annuler') {
    userInfo.state = LOYALTY_STATES.IDLE;
    userState.set(userId, userInfo);
    await bot.sendMessage(chatId, 'Opération annulée.');
    return true;
  }
  
  // Gérer les différents états
  switch (userInfo.state) {
    case LOYALTY_STATES.WAITING_FOR_PROGRAM_NAME:
      // Enregistrer le nom et demander le nombre de points
      userInfo.programName = text;
      userInfo.state = LOYALTY_STATES.WAITING_FOR_PROGRAM_SUPPLY;
      userState.set(userId, userInfo);
      
      await bot.sendMessage(
        chatId,
        `Nom du programme: *${text}*\n\nVeuillez entrer le nombre de points à créer:`,
        { parse_mode: 'Markdown' }
      );
      return true;
      
    case LOYALTY_STATES.WAITING_FOR_PROGRAM_SUPPLY:
      // Valider que l'entrée est un nombre
      const supply = parseInt(text.trim(), 10);
      if (isNaN(supply) || supply <= 0 || supply > 100000000) {
        await bot.sendMessage(
          chatId,
          'Veuillez entrer un nombre valide entre 1 et 100 000 000.'
        );
        return true;
      }
      
      // Créer le programme de fidélité
      await bot.sendMessage(chatId, 'Création du programme de fidélité en cours...');
      
      const createResult = await createLoyaltyProgram(
        userId,
        userInfo.programName,
        supply
      );
      
      // Réinitialiser l'état
      userInfo.state = LOYALTY_STATES.IDLE;
      userState.set(userId, userInfo);
      
      if (createResult.success) {
        await bot.sendMessage(
          chatId,
          `✅ ${createResult.message}\n\nID du token: ${createResult.tokenId}\n\nVous pouvez maintenant permettre à vos clients de gagner des points en utilisant la commande /earnpoints`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `❌ ${createResult.message}`
        );
      }
      return true;
      
    case LOYALTY_STATES.WAITING_FOR_PROGRAM_SELECTION:
      // Trouver le programme sélectionné
      const selectedProgram = userInfo.programs.find(p => `${p.name} (${p.token_id})` === text);
      
      if (!selectedProgram) {
        await bot.sendMessage(
          chatId,
          "Je n'ai pas reconnu ce programme. Veuillez sélectionner un programme dans la liste."
        );
        return true;
      }
      
      // Enregistrer la sélection et demander la facture
      userInfo.selectedProgram = selectedProgram;
      userInfo.state = LOYALTY_STATES.WAITING_FOR_RECEIPT;
      userState.set(userId, userInfo);
      
      await bot.sendMessage(
        chatId,
        `Programme sélectionné: *${selectedProgram.name}*\n\nVeuillez prendre une photo de votre facture pour gagner des points:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [[{ text: 'Annuler' }]],
            resize_keyboard: true
          }
        }
      );
      return true;
  }
  
  return false;
}

/**
 * Gérer la réception d'une photo pour l'analyse de facture
 * @param {TelegramBot} bot - Instance du bot Telegram
 * @param {object} msg - Message Telegram
 * @returns {boolean} Vrai si la photo a été gérée, faux sinon
 */
async function handleReceiptPhoto(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Vérifier si nous attendons une photo de facture
  if (!userState.has(userId)) return false;
  
  const userInfo = userState.get(userId);
  
  if (userInfo.state !== LOYALTY_STATES.WAITING_FOR_RECEIPT) {
    return false;
  }
  
  // Vérifier si le message contient une photo
  if (!msg.photo || msg.photo.length === 0) {
    return false;
  }
  
  // Obtenir l'ID du fichier photo (prendre la plus grande résolution disponible)
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  
  await bot.sendMessage(chatId, 'Analyse de votre facture en cours...');
  
  try {
    // Récupérer le fichier photo
    const fileLink = await bot.getFileLink(fileId);
    
    // Télécharger la photo
    const response = await fetch(fileLink);
    const buffer = await response.arrayBuffer();
    
    // Convertir en Base64
    const base64Image = Buffer.from(buffer).toString('base64');
    
    // Analyser la facture avec GPT-4V
    const analysisResult = await analyzeReceipt(base64Image);
    
    if (!analysisResult.success) {
      await bot.sendMessage(
        chatId,
        `❌ ${analysisResult.message}\n\nVeuillez réessayer avec une photo plus claire.`
      );
      return true;
    }
    
    // Calculer les points à attribuer
    const totalAmount = analysisResult.total;
    const pointsRate = userInfo.selectedProgram.points_rate || 0.25;
    const pointsToAward = calculatePoints(totalAmount, pointsRate);
    
    await bot.sendMessage(
      chatId,
      `Montant total détecté: *${totalAmount.toFixed(2)}*€\n\nVous allez recevoir *${pointsToAward}* points de fidélité sur le programme *${userInfo.selectedProgram.name}*.`,
      { parse_mode: 'Markdown' }
    );
    
    // Attribuer les points
    await bot.sendMessage(chatId, 'Attribution des points en cours...');
    
    const awardResult = await awardLoyaltyPoints(
      userId,
      userInfo.selectedProgram.token_id,
      pointsToAward
    );
    
    // Réinitialiser l'état
    userInfo.state = LOYALTY_STATES.IDLE;
    userState.set(userId, userInfo);
    
    if (awardResult.success) {
      await bot.sendMessage(
        chatId,
        `✅ Félicitations ! Vous avez reçu *${pointsToAward}* points sur le programme *${userInfo.selectedProgram.name}*.\n\nVous pouvez vérifier votre solde avec la commande /balance`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            remove_keyboard: true
          }
        }
      );
    } else {
      await bot.sendMessage(
        chatId,
        `❌ ${awardResult.message}`,
        {
          reply_markup: {
            remove_keyboard: true
          }
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error(`Erreur lors du traitement de la photo: ${error.message}`);
    
    await bot.sendMessage(
      chatId,
      `❌ Une erreur est survenue lors du traitement de votre facture: ${error.message}`,
      {
        reply_markup: {
          remove_keyboard: true
        }
      }
    );
    
    // Réinitialiser l'état
    userInfo.state = LOYALTY_STATES.IDLE;
    userState.set(userId, userInfo);
    
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
