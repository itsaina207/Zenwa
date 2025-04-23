/**
 * Service LLM pour le traitement du langage naturel
 * Utilise l'API OpenAI pour analyser les commandes en langage naturel
 */

const OpenAI = require('openai');
const { OPENAI_API_KEY } = require('../config');

// Initialiser le client OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Analyser une commande en langage naturel et extraire l'intention et les paramètres
 * @param {string} userId - ID de l'utilisateur Telegram
 * @param {string} message - Message en langage naturel
 * @returns {Promise<object>} Intention et paramètres extraits
 */
async function analyzeIntent(userId, message) {
  try {
    // Définir les actions possibles et leur format
    const systemPrompt = `
    Vous êtes un assistant spécialisé pour un wallet Hedera. Votre tâche est d'analyser les messages des utilisateurs 
    et d'identifier leur intention concernant les opérations blockchain.
    
    Voici les actions possibles :
    1. balance - Vérifier le solde du wallet
    2. history - Voir l'historique des transactions
    3. send_hbar - Envoyer des HBAR à un autre compte
    4. send_token - Envoyer des tokens à un autre compte
    5. mint_token - Créer un nouveau token
    6. unknown - Si l'intention n'est pas claire ou ne correspond à aucune action ci-dessus
    
    Vous devez répondre avec un objet JSON contenant les propriétés suivantes :
    - action: l'une des actions ci-dessus (string)
    - params: un objet contenant les paramètres nécessaires pour l'action
    
    Paramètres pour chaque action :
    - balance: {} (aucun paramètre requis)
    - history: { limit?: number } (optionnel, nombre de transactions à afficher)
    - send_hbar: { recipient: string, amount: string } (obligatoire)
    - send_token: { recipient: string, tokenId: string, amount: number } (obligatoire)
    - mint_token: { name: string, symbol: string } (obligatoire)
    - unknown: {} (aucun paramètre)
    
    Si des informations essentielles sont manquantes, identifiez l'action mais laissez les paramètres manquants vides.
    `;

    // Appeler l'API OpenAI pour analyser le message
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // le modèle le plus récent d'OpenAI, sorti le 13 mai 2024
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Réduire la température pour des réponses plus précises
    });

    // Extraire la réponse
    const response = JSON.parse(completion.choices[0].message.content);
    console.log('LLM response:', response);

    return {
      success: true,
      action: response.action,
      params: response.params || {}
    };
  } catch (error) {
    console.error(`Erreur dans l'analyse LLM: ${error.message}`);
    return {
      success: false,
      action: 'unknown',
      params: {},
      error: error.message
    };
  }
}

module.exports = {
  analyzeIntent
};