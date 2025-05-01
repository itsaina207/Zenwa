/**
 * Service OpenAI pour l'analyse du langage naturel
 * Extrait les intentions des messages utilisateur et les mappe aux fonctions Hedera Agent Kit
 * Intègre le plugin Eliza pour les requêtes d'information sur la blockchain
 */

require('dotenv').config();
const { getHederaAgentKit } = require('../agent/hedera-agent-kit-integration');
const { OpenAI } = require('openai');
const { processElizaQuery } = require('../plugins/eliza-plugin');

// Vérifier que la clé API est présente
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn('Clé API OpenAI manquante - les fonctionnalités NLP ne seront pas disponibles');
}

// Initialiser le client OpenAI si la clé est disponible
const openai = OPENAI_API_KEY ? new OpenAI({
  apiKey: OPENAI_API_KEY,
}) : null;

/**
 * Analyser un message en langage naturel et extraire l'intention et les paramètres
 * @param {string} userId - ID de l'utilisateur Telegram
 * @param {string} message - Message en langage naturel
 * @returns {Promise<object>} Intention et paramètres extraits
 */
async function analyzeIntent(userId, message) {
  if (!openai) {
    return {
      success: false,
      error: 'Service OpenAI non disponible - clé API manquante'
    };
  }

  try {
    // Récupérer les outils d'Hedera Agent Kit comme contexte
    let kitReference = '';
    try {
      const kit = await getHederaAgentKit();
      if (kit) {
        kitReference = 'Vous devez utiliser les fonctions de Hedera Agent Kit disponibles : getHbarBalance, transferHbar, createFT, getTransactionHistory, createTopic, submitTopicMessage, getTopicMessages, getTopicInfo, transferToken, getHtsTokenDetails, getTokenHolders.';
      }
    } catch (error) {
      console.warn(`Impossible de charger Hedera Agent Kit: ${error.message}`);
    }

    // Structure du système pour guider le modèle
    const systemPrompt = `
      Vous êtes un assistant spécialisé dans Hedera cryptocurrency wallet.
      Votre tâche est d'analyser le message de l'utilisateur et d'identifier l'action qu'il souhaite réaliser.
      ${kitReference}
      
      Vous devez extraire les informations suivantes du message :
      1. L'action principale (vérifier le solde, envoyer des HBAR, créer un token, etc.)
      2. Les paramètres nécessaires pour cette action (montant, destinataire, etc.)
      
      Voici les actions possibles et leurs paramètres :
      - check_balance : vérifier le solde (pas de paramètre requis)
      - transfer_hbar : envoyer des HBAR (paramètres: recipientId, amount)
      - create_token : créer un token (paramètres: name, symbol, initialSupply) 
          Note: initialSupply est optionnel et est limité à 100 000 000 maximum
      - transfer_token : envoyer des tokens (paramètres: recipientId, tokenId, amount)
      - get_history : consulter l'historique des transactions (paramètre optionnel: limit)
      - create_topic : créer un topic HCS (paramètres: topicName, submitKey)
      - submit_message : envoyer un message à un topic (paramètres: topicId, message)
      - get_topic_messages : récupérer les messages d'un topic (paramètre: topicId)
      - create_airdrop : créer un airdrop de tokens (paramètres: tokenId, recipientIds, amounts)
      - claim_airdrop : réclamer un airdrop (paramètres: airdropId)
      - get_airdrops : voir les airdrops disponibles (pas de paramètre requis)
      
      Répondez uniquement avec un objet JSON contenant l'action identifiée et les paramètres extraits.
      Format: { "action": "nom_action", "params": { "param1": "valeur1", ... } }
      Si vous ne pouvez pas identifier l'intention, retournez { "action": "unknown", "params": {} }
    `;

    // Faire une requête à l'API OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // le modèle le plus récent d'OpenAI, sorti le 13 mai 2024
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3 // Plus faible pour des réponses plus prévisibles
    });

    // Extraire la réponse
    const content = response.choices[0].message.content;
    const parsedResult = JSON.parse(content);

    return {
      success: true,
      action: parsedResult.action,
      params: parsedResult.params
    };
  } catch (error) {
    console.error(`Erreur lors de l'analyse OpenAI: ${error.message}`);
    return {
      success: false,
      error: `Erreur lors de l'analyse du message: ${error.message}`
    };
  }
}

/**
 * Détecter si un message est une demande de vérification de solde
 * Cette fonction simple permet de détecter les intentions sans avoir à appeler l'API OpenAI
 * pour les cas les plus courants, comme une économie de coûts
 * @param {string} message - Message utilisateur
 * @returns {boolean} True si c'est une demande de vérification de solde
 */
function isBalanceCheck(message) {
  const lowerMessage = message.toLowerCase();
  const balanceKeywords = [
    'solde', 'balance', 'hbar', 'combien', 'avoir', 'wallet',
    'portefeuille', 'compte', 'tokens', 'jeton', 'argent'
  ];
  
  // Vérifier si au moins deux mots-clés sont présents
  let keywordCount = 0;
  for (const keyword of balanceKeywords) {
    if (lowerMessage.includes(keyword)) {
      keywordCount++;
      if (keywordCount >= 2) return true;
    }
  }
  
  return false;
}

/**
 * Détecter si un message est une demande d'historique de transactions
 * @param {string} message - Message utilisateur
 * @returns {boolean} True si c'est une demande d'historique
 */
function isHistoryCheck(message) {
  const lowerMessage = message.toLowerCase();
  const historyKeywords = [
    'historique', 'history', 'transactions', 'activité', 
    'récent', 'dernières', 'opérations'
  ];
  
  for (const keyword of historyKeywords) {
    if (lowerMessage.includes(keyword)) return true;
  }
  
  return false;
}

/**
 * Détecter si un message est une demande simple de création de token
 * @param {string} message - Message utilisateur
 * @returns {boolean} True si c'est une demande de création de token
 */
function isCreateTokenRequest(message) {
  const lowerMessage = message.toLowerCase();
  
  // Patterns for token creation requests
  if (
    // Common direct requests
    (lowerMessage.includes('crée') || lowerMessage.includes('cree') || 
     lowerMessage.includes('créer') || lowerMessage.includes('creer') ||
     lowerMessage.includes('faire') || lowerMessage.includes('create')) &&
    (lowerMessage.includes('token') || lowerMessage.includes('jeton')) &&
    // Check that it doesn't have all details already
    !(lowerMessage.includes('symbole') && lowerMessage.includes('supply'))
  ) {
    return true;
  }
  
  return false;
}

/**
 * Détecter si un message est une demande d'airdrops disponibles
 * @param {string} message - Message utilisateur
 * @returns {boolean} True si c'est une demande d'airdrops
 */
function isGetAirdropsRequest(message) {
  const lowerMessage = message.toLowerCase();
  const airdropKeywords = [
    'airdrop', 'airdrops', 'disponible', 'available', 'claim', 'réclamer',
    'recevoir', 'gratuit', 'free', 'tokens gratuits', 'mes airdrops'
  ];
  
  for (const keyword of airdropKeywords) {
    if (lowerMessage.includes(keyword)) return true;
  }
  
  return false;
}

/**
 * Détecter si un message est une demande de création d'airdrop
 * @param {string} message - Message utilisateur
 * @returns {boolean} True si c'est une demande de création d'airdrop
 */
function isCreateAirdropRequest(message) {
  const lowerMessage = message.toLowerCase();
  
  if (
    (lowerMessage.includes('crée') || lowerMessage.includes('créer') || 
     lowerMessage.includes('create') || lowerMessage.includes('faire') || 
     lowerMessage.includes('lancer') || lowerMessage.includes('distribuer')) &&
    (lowerMessage.includes('airdrop') || 
     (lowerMessage.includes('distribu') && lowerMessage.includes('token')))
  ) {
    return true;
  }
  
  return false;
}

/**
 * Détecter si un message est une requête Eliza pour interroger la blockchain
 * @param {string} message - Message utilisateur
 * @returns {boolean} True si c'est une requête pour le plugin Eliza
 */
function isElizaQuery(message) {
  const lowerMessage = message.toLowerCase().trim();
  
  const elizaPatterns = [
    // Requêtes d'éligibilité aux airdrops
    { keywords: ['eligible', 'airdrop'], threshold: 2 },
    { keywords: ['droit', 'airdrop'], threshold: 2 },
    { keywords: ['recevoir', 'airdrop'], threshold: 2 },
    { keywords: ['eligibilite', 'airdrop'], threshold: 2 },
    { keywords: ['éligibilité', 'airdrop'], threshold: 2 },
    
    // Requêtes sur les propriétaires de tokens
    { keywords: ['qui', 'possède', 'token'], threshold: 2 },
    { keywords: ['qui', 'possede', 'token'], threshold: 2 },
    { keywords: ['who', 'owns', 'token'], threshold: 2 },
    { keywords: ['liste', 'possesseurs', 'token'], threshold: 2 },
    { keywords: ['liste', 'détenteurs', 'token'], threshold: 2 },
    { keywords: ['liste', 'detenteurs', 'token'], threshold: 2 },
    { keywords: ['list', 'holders', 'token'], threshold: 2 },
    { keywords: ['propriétaires', 'token'], threshold: 2 },
    { keywords: ['proprietaires', 'token'], threshold: 2 },
    
    // Requêtes d'information sur les tokens
    { keywords: ['token', 'information'], threshold: 2 },
    { keywords: ['token', 'informations'], threshold: 2 },
    { keywords: ['token', 'info'], threshold: 2 },
    { keywords: ['détails', 'token'], threshold: 2 },
    { keywords: ['details', 'token'], threshold: 2 },
    { keywords: ['supply', 'token'], threshold: 2 },
    { keywords: ['offre', 'token'], threshold: 2 },
    { keywords: ['treasury', 'token'], threshold: 2 },
    { keywords: ['trésorerie', 'token'], threshold: 2 },
    
    // Requêtes générales sur la blockchain
    { keywords: ['interroger', 'blockchain'], threshold: 2 },
    { keywords: ['query', 'blockchain'], threshold: 2 },
    { keywords: ['demander', 'blockchain'], threshold: 2 },
    { keywords: ['blockchain', 'info'], threshold: 2 },
    
    // Requêtes sur le solde des tokens
    { keywords: ['solde', 'token'], threshold: 2 },
    { keywords: ['balance', 'token'], threshold: 2 },
    { keywords: ['mes', 'tokens'], threshold: 2 }
  ];
  
  // Recherche de correspondance dans les patterns
  for (const pattern of elizaPatterns) {
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword)) {
        matchCount++;
      }
    }
    if (matchCount >= pattern.threshold) {
      return true;
    }
  }
  
  // Vérifier si un ID de token est mentionné (format 0.0.XXXXX)
  if (lowerMessage.match(/0\.0\.\d+/)) {
    if (lowerMessage.includes('token') || 
        lowerMessage.includes('qui') || 
        lowerMessage.includes('possede') || 
        lowerMessage.includes('possède') || 
        lowerMessage.includes('détenteurs') || 
        lowerMessage.includes('detenteurs') || 
        lowerMessage.includes('holders') || 
        lowerMessage.includes('owns') ||
        lowerMessage.includes('info') ||
        lowerMessage.includes('details') ||
        lowerMessage.includes('détails')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Traiter une requête via le plugin Eliza
 * @param {string} userId - ID de l'utilisateur Telegram
 * @param {string} message - Message en langage naturel
 * @returns {Promise<object>} Résultat de la requête Eliza
 */
async function processWithEliza(userId, message) {
  try {
    const elizaResult = await processElizaQuery(userId, message);
    return {
      success: true,
      action: 'eliza_query',
      response: elizaResult.message,
      isElizaResponse: true
    };
  } catch (error) {
    console.error(`Erreur lors du traitement avec Eliza: ${error.message}`);
    return {
      success: false,
      error: `Erreur lors du traitement de votre requête sur la blockchain: ${error.message}`
    };
  }
}

module.exports = {
  analyzeIntent,
  isBalanceCheck,
  isHistoryCheck,
  isCreateTokenRequest,
  isGetAirdropsRequest,
  isCreateAirdropRequest,
  isElizaQuery,
  processWithEliza,
  openai // Exporter le client OpenAI pour l'utiliser avec GPT-4V
};