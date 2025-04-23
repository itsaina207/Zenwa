/**
 * Service LLM pour le traitement du langage naturel
 * Utilise l'API OpenAI pour analyser les commandes en langage naturel
 * Intégration avec Hedera Agent Kit pour des fonctionnalités avancées
 */

const OpenAI = require('openai');
const { OPENAI_API_KEY } = require('../config');
const { getHederaAgentTools } = require('../agent/hedera-agent-kit-integration');

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
    // Récupérer les outils du Hedera Agent Kit (s'ils sont disponibles)
    let kitTools = [];
    try {
      kitTools = await getHederaAgentTools();
      if (kitTools && kitTools.length > 0) {
        console.log('Hedera Agent Kit tools loaded successfully for LLM service');
      }
    } catch (error) {
      console.warn(`Unable to load Hedera Agent Kit tools: ${error.message}`);
    }

    // Définir les actions possibles et leur format, en incluant les fonctionnalités de l'Agent Kit
    const systemPrompt = `
    Vous êtes un assistant spécialisé pour un wallet Hedera. Votre tâche est d'analyser les messages des utilisateurs 
    et d'identifier leur intention concernant les opérations blockchain.
    
    Voici les actions possibles :
    1. balance - Vérifier le solde du wallet (HBAR et tokens)
    2. history - Voir l'historique des transactions
    3. send_hbar - Envoyer des HBAR à un autre compte
    4. send_token - Envoyer des tokens à un autre compte
    5. mint_token - Créer un nouveau token fongible
    6. associate_token - Associer un token à un compte (disponible avec Hedera Agent Kit)
    7. dissociate_token - Dissocier un token d'un compte (disponible avec Hedera Agent Kit)
    8. create_topic - Créer un nouveau topic HCS (disponible avec Hedera Agent Kit)
    9. submit_message - Soumettre un message à un topic (disponible avec Hedera Agent Kit)
    10. unknown - Si l'intention n'est pas claire ou ne correspond à aucune action ci-dessus
    
    Vous devez répondre avec un objet JSON contenant les propriétés suivantes :
    - action: l'une des actions ci-dessus (string)
    - params: un objet contenant les paramètres nécessaires pour l'action
    
    Paramètres pour chaque action :
    - balance: {} (aucun paramètre requis)
    - history: { limit?: number } (optionnel, nombre de transactions à afficher)
    - send_hbar: { recipient: string, amount: string } (obligatoire)
    - send_token: { recipient: string, tokenId: string, amount: number } (obligatoire)
      * Important pour send_token: le tokenId peut être soit un ID au format Hedera (0.0.xxx) soit un nom ou symbole de token comme "MoonCoin" ou "MOON"
      * Analysez soigneusement le message pour extraire le nom du token et le placer dans le paramètre tokenId
    - mint_token: { name: string, symbol: string, initialSupply?: number, decimals?: number } (obligatoire: name, symbol; optionnel: autres)
    - associate_token: { tokenId: string } (obligatoire)
    - dissociate_token: { tokenId: string } (obligatoire)
    - create_topic: { topicName: string, submitKey?: boolean } (obligatoire: topicName; optionnel: submitKey)
    - submit_message: { topicId: string, message: string } (obligatoire)
    - unknown: {} (aucun paramètre)
    
    Si des informations essentielles sont manquantes, identifiez l'action mais laissez les paramètres manquants vides.
    
    Exemples d'entrées et de réponses attendues:
    
    Exemple 1: "Quel est mon solde?"
    Réponse: {"action":"balance","params":{}}
    
    Exemple 2: "Envoyer 50 HBAR au compte 0.0.12345"
    Réponse: {"action":"send_hbar","params":{"recipient":"0.0.12345","amount":"50"}}
    
    Exemple 3: "Montrer mes 5 dernières transactions"
    Réponse: {"action":"history","params":{"limit":5}}
    
    Exemple 4: "Créer un token nommé StarToken avec symbole STR"
    Réponse: {"action":"mint_token","params":{"name":"StarToken","symbol":"STR"}}
    
    Exemple 5: "Envoyer 100 MoonCoins au compte 0.0.67890"
    Réponse: {"action":"send_token","params":{"recipient":"0.0.67890","tokenId":"MoonCoins","amount":100}}
    
    Exemple 6: "Associer le token 0.0.12345 à mon compte"
    Réponse: {"action":"associate_token","params":{"tokenId":"0.0.12345"}}
    
    Exemple 7: "Créer un topic nommé News"
    Réponse: {"action":"create_topic","params":{"topicName":"News","submitKey":true}}
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