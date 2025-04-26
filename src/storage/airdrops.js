/**
 * Module de gestion des airdrops dans la base de données
 * Permet de stocker et récupérer les informations d'airdrop
 */

const { query } = require('./db');

/**
 * Enregistre un nouvel airdrop dans la base de données
 * @param {Object} airdropData - Données de l'airdrop
 * @param {string} airdropData.creatorId - ID de l'utilisateur créateur
 * @param {string} airdropData.tokenId - ID du token
 * @param {string} airdropData.tokenName - Nom du token (optionnel)
 * @param {string} airdropData.transactionId - ID de la transaction
 * @param {string} airdropData.pendingAirdropId - ID d'airdrop en attente (optionnel)
 * @param {number} airdropData.totalAmount - Montant total distribué
 * @param {Array<Object>} airdropData.recipients - Liste des destinataires
 * @returns {Promise<Object>} - Résultat de l'opération
 */
async function storeAirdrop(airdropData) {
  const { pool } = require('./db');
  const client = await pool.connect();
  
  try {
    // Commencer une transaction
    await client.query('BEGIN');
    
    // Insérer l'airdrop principal
    const airdropInsert = await client.query(
      `INSERT INTO airdrops
        (creator_id, token_id, token_name, transaction_id, pending_airdrop_id, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
      [
        airdropData.creatorId,
        airdropData.tokenId,
        airdropData.tokenName || null,
        airdropData.transactionId,
        airdropData.pendingAirdropId || null,
        airdropData.totalAmount
      ]
    );
    
    const airdropId = airdropInsert.rows[0].id;
    
    // Insérer les destinataires
    for (const recipient of airdropData.recipients) {
      await client.query(
        `INSERT INTO airdrop_recipients
          (airdrop_id, recipient_id, account_id, amount)
          VALUES ($1, $2, $3, $4)`,
        [
          airdropId,
          recipient.originalId || 'unknown',
          recipient.accountId,
          recipient.amount
        ]
      );
    }
    
    // Valider la transaction
    await client.query('COMMIT');
    
    return {
      success: true,
      airdropId
    };
  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await client.query('ROLLBACK');
    console.error('Erreur lors de l\'enregistrement de l\'airdrop:', error);
    
    return {
      success: false,
      message: `Erreur lors de l'enregistrement de l'airdrop: ${error.message}`
    };
  } finally {
    client.release();
  }
}

/**
 * Récupère les airdrops disponibles pour un utilisateur
 * @param {string} accountId - ID du compte Hedera
 * @returns {Promise<Array<Object>>} - Liste des airdrops disponibles
 */
async function getAvailableAirdropsForAccount(accountId) {
  try {
    const result = await query(
      `SELECT a.id, a.token_id, a.token_name, a.pending_airdrop_id, ar.amount
       FROM airdrops a
       JOIN airdrop_recipients ar ON a.id = ar.airdrop_id
       WHERE ar.account_id = $1
       AND ar.claimed = FALSE
       AND a.status = 'ACTIVE'
       ORDER BY a.created_at DESC`,
      [accountId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      tokenId: row.token_id,
      tokenName: row.token_name || 'Token',
      pendingAirdropId: row.pending_airdrop_id,
      amount: row.amount
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des airdrops disponibles:', error);
    return [];
  }
}

/**
 * Marque un airdrop comme réclamé par un utilisateur
 * @param {string} accountId - ID du compte Hedera du réclamant
 * @param {string} airdropId - ID de l'airdrop
 * @returns {Promise<Object>} - Résultat de l'opération
 */
async function markAirdropAsClaimed(accountId, airdropId) {
  try {
    const result = await query(
      `UPDATE airdrop_recipients
       SET claimed = TRUE, claimed_at = NOW()
       WHERE account_id = $1 AND airdrop_id = $2
       RETURNING id`,
      [accountId, airdropId]
    );
    
    if (result.rowCount > 0) {
      return {
        success: true,
        message: 'Airdrop marqué comme réclamé'
      };
    } else {
      return {
        success: false,
        message: 'Aucun airdrop trouvé pour cette combinaison de compte et d\'ID'
      };
    }
  } catch (error) {
    console.error('Erreur lors du marquage de l\'airdrop comme réclamé:', error);
    return {
      success: false,
      message: `Erreur: ${error.message}`
    };
  }
}

module.exports = {
  storeAirdrop,
  getAvailableAirdropsForAccount,
  markAirdropAsClaimed
};