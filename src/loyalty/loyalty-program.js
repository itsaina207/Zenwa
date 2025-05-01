/**
 * Module de gestion des programmes de fidélité
 * Ce module permet de créer des programmes de fidélité basés sur des tokens fongibles
 * et d'attribuer des points en scannant des factures
 */

const { createToken } = require('../hedera/tokens');
const { transferToken } = require('../hedera/token-management');
const { openai } = require('../services/openai-service');
const { executeQuery } = require('../storage/db');
const { getWalletByUserId } = require('../storage/userWallets');

/**
 * Initialiser la table des programmes de fidélité
 */
async function initLoyaltyProgramsTable() {
  try {
    // Créer la table des programmes de fidélité si elle n'existe pas
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS loyalty_programs (
        id SERIAL PRIMARY KEY,
        token_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        points_rate NUMERIC(10, 2) DEFAULT 0.25,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table des programmes de fidélité initialisée');
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'initialisation de la table des programmes de fidélité: ${error.message}`);
    return false;
  }
}

/**
 * Créer un programme de fidélité
 * @param {string} userId - ID Telegram de l'utilisateur créateur
 * @param {string} programName - Nom du programme de fidélité
 * @param {number} supply - Quantité de points à créer
 * @returns {Promise<object>} Résultat de la création
 */
async function createLoyaltyProgram(userId, programName, supply) {
  try {
    // Créer un token fongible pour le programme de fidélité
    const tokenInfo = {
      name: programName,
      symbol: 'POINTS',
      decimals: 0,
      initialSupply: supply,
      maxSupply: 100000000, // Limite max comme demandé
      autoRenewAccountId: null, // Sera rempli par createToken
      expirationDays: 365
    };

    const tokenResult = await createToken(userId, tokenInfo);

    if (!tokenResult.success) {
      return tokenResult;
    }

    // Enregistrer le programme de fidélité dans la base de données
    await executeQuery(`
      INSERT INTO loyalty_programs (token_id, name, owner_id, points_rate)
      VALUES ($1, $2, $3, $4)
    `, [tokenResult.tokenId, programName, userId, 0.25]);

    return {
      success: true,
      message: `Programme de fidélité "${programName}" créé avec succès !`,
      tokenId: tokenResult.tokenId,
      explorerId: tokenResult.tokenId,
      explorerUrl: tokenResult.explorerUrl
    };
  } catch (error) {
    console.error(`Erreur lors de la création du programme de fidélité: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la création du programme de fidélité: ${error.message}`
    };
  }
}

/**
 * Récupérer les programmes de fidélité d'un utilisateur
 * @param {string} userId - ID Telegram de l'utilisateur
 * @returns {Promise<Array>} Liste des programmes de fidélité
 */
async function getUserLoyaltyPrograms(userId) {
  try {
    const result = await executeQuery(`
      SELECT * FROM loyalty_programs WHERE owner_id = $1
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error(`Erreur lors de la récupération des programmes de fidélité: ${error.message}`);
    return [];
  }
}

/**
 * Récupérer tous les programmes de fidélité disponibles
 * @returns {Promise<Array>} Liste de tous les programmes de fidélité
 */
async function getAllLoyaltyPrograms() {
  try {
    const result = await executeQuery(`
      SELECT * FROM loyalty_programs
    `);

    return result.rows;
  } catch (error) {
    console.error(`Erreur lors de la récupération des programmes de fidélité: ${error.message}`);
    return [];
  }
}

/**
 * Analyser une image de facture avec GPT-4V
 * @param {string} imageBase64 - Image en base64
 * @returns {Promise<object>} Résultat de l'analyse
 */
async function analyzeReceipt(imageBase64) {
  try {
    // Analyser l'image avec GPT-4V
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // le modèle le plus récent qui supporte la vision
      messages: [
        {
          role: "system",
          content: "Tu es un assistant spécialisé dans l'extraction d'informations de factures et tickets de caisse. Tu dois extraire uniquement le montant total. Réponds uniquement avec un objet JSON contenant la clé 'total' dont la valeur est le montant numérique."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extrait le montant total à payer de ce ticket. Réponds uniquement avec un objet JSON avec la clé 'total' dont la valeur est le montant numérique."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    // Extraire le montant total
    const result = JSON.parse(response.choices[0].message.content);
    const total = parseFloat(result.total);

    if (isNaN(total)) {
      return {
        success: false,
        message: "Impossible d'extraire un montant total valide de cette facture."
      };
    }

    return {
      success: true,
      total: total
    };
  } catch (error) {
    console.error(`Erreur lors de l'analyse de la facture: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de l'analyse de la facture: ${error.message}`
    };
  }
}

/**
 * Calculer le nombre de points à attribuer
 * @param {number} totalAmount - Montant total de la facture
 * @param {number} pointRate - Taux de conversion (par défaut: 0.25)
 * @returns {number} Nombre de points à attribuer
 */
function calculatePoints(totalAmount, pointRate = 0.25) {
  // Retirer les décimales
  const cleanAmount = Math.floor(totalAmount);
  // Calculer les points (25% de la valeur)
  return Math.floor(cleanAmount * pointRate);
}

/**
 * Attribuer des points de fidélité à un utilisateur
 * @param {string} userId - ID Telegram de l'utilisateur
 * @param {string} programId - ID du programme de fidélité (token ID)
 * @param {number} amount - Montant de points à attribuer
 * @returns {Promise<object>} Résultat de l'attribution
 */
async function awardLoyaltyPoints(userId, programId, amount) {
  try {
    // Récupérer les infos du programme de fidélité
    const programResult = await executeQuery(`
      SELECT * FROM loyalty_programs WHERE token_id = $1
    `, [programId]);

    if (programResult.rows.length === 0) {
      return {
        success: false,
        message: "Programme de fidélité introuvable."
      };
    }

    const program = programResult.rows[0];
    const ownerUserId = program.owner_id;

    // Récupérer les adresses Hedera
    const ownerWallet = await getWalletByUserId(ownerUserId);
    const userWallet = await getWalletByUserId(userId);

    if (!ownerWallet || !userWallet) {
      return {
        success: false,
        message: "Wallet introuvable pour l'attribution des points."
      };
    }

    // Transférer les tokens (points) du propriétaire du programme à l'utilisateur
    const transferResult = await transferToken(
      ownerUserId,
      userWallet.account_id,
      programId,
      amount
    );

    return transferResult;
  } catch (error) {
    console.error(`Erreur lors de l'attribution des points: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de l'attribution des points: ${error.message}`
    };
  }
}

module.exports = {
  initLoyaltyProgramsTable,
  createLoyaltyProgram,
  getUserLoyaltyPrograms,
  getAllLoyaltyPrograms,
  analyzeReceipt,
  calculatePoints,
  awardLoyaltyPoints
};
