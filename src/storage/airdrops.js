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
  
  console.log('Tentative d\'enregistrement d\'airdrop avec les données:', JSON.stringify(airdropData, null, 2));
  
  try {
    // Commencer une transaction
    await client.query('BEGIN');
    
    // Insérer l'airdrop principal
    console.log('Insertion de l\'airdrop principal avec:', {
      creatorId: airdropData.creatorId,
      tokenId: airdropData.tokenId,
      tokenName: airdropData.tokenName || null,
      transactionId: airdropData.transactionId,
      pendingAirdropId: airdropData.pendingAirdropId || null,
      totalAmount: airdropData.totalAmount
    });
    
    const airdropInsert = await client.query(
      `INSERT INTO airdrops
        (creator_id, token_id, token_name, token_symbol, treasury_id, transaction_id, pending_airdrop_id, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
      [
        airdropData.creatorId,
        airdropData.tokenId,
        airdropData.tokenName || null,
        airdropData.tokenSymbol || null,
        airdropData.treasuryId || null,
        airdropData.transactionId,
        airdropData.pendingAirdropId || null,
        airdropData.totalAmount
      ]
    );
    
    const airdropId = airdropInsert.rows[0].id;
    console.log(`Airdrop principal inséré avec succès, ID: ${airdropId}`);
    
    // Insérer les destinataires
    console.log(`Insertion de ${airdropData.recipients.length} destinataires`);
    for (const recipient of airdropData.recipients) {
      console.log('Insertion du destinataire:', {
        airdropId: airdropId,
        recipientId: recipient.originalId || 'unknown',
        accountId: recipient.accountId,
        amount: recipient.amount
      });
      
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
    console.log(`Transaction validée avec succès pour l'airdrop ${airdropId}`);
    
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
    console.log(`Recherche d'airdrops disponibles pour le compte ${accountId}`);
    
    // Vérifier d'abord la structure de la table
    const checkTable = await query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'airdrop_recipients')",
      []
    );
    
    console.log(`Table airdrop_recipients existe : ${checkTable.rows[0].exists}`);
    
    if (checkTable.rows[0].exists) {
      // Compter le nombre total d'airdrop_recipients pour ce compte
      const countRecipients = await query(
        `SELECT COUNT(*) FROM airdrop_recipients WHERE account_id = $1`,
        [accountId]
      );
      
      console.log(`Nombre total d'enregistrements pour ce compte : ${countRecipients.rows[0].count}`);
      
      // Compter le nombre d'airdrops non réclamés pour ce compte
      const countUnclaimedRecipients = await query(
        `SELECT COUNT(*) FROM airdrop_recipients WHERE account_id = $1 AND claimed = FALSE`,
        [accountId]
      );
      
      console.log(`Nombre d'airdrops non réclamés : ${countUnclaimedRecipients.rows[0].count}`);
    }
    
    // Récupérer les informations complètes des airdrops disponibles
    const result = await query(
      `SELECT a.id, a.token_id, a.token_name, a.token_symbol, a.treasury_id, 
              a.pending_airdrop_id, ar.amount, ar.claimed, a.created_at
       FROM airdrops a
       JOIN airdrop_recipients ar ON a.id = ar.airdrop_id
       WHERE ar.account_id = $1
       AND ar.claimed = FALSE
       ORDER BY a.created_at DESC`,
      [accountId]
    );
    
    console.log(`Résultat de la requête : ${result.rowCount} lignes trouvées`);
    
    if (result.rowCount > 0) {
      console.log(`Premier résultat :`, result.rows[0]);
    }
    
    return result.rows.map(row => ({
      id: row.id,
      tokenId: row.token_id,
      tokenName: row.token_name || 'Token',
      tokenSymbol: row.token_symbol || '',
      treasuryId: row.treasury_id || null,
      pendingAirdropId: row.pending_airdrop_id,
      amount: row.amount,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des airdrops disponibles:', error);
    console.error('Détails de l\'erreur:', error.stack);
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
    console.log(`[CLAIM_DB] 🔍 Tentative de marquer l'airdrop ${airdropId} comme réclamé par le compte ${accountId}`);
    
    // Vérifier si l'enregistrement existe avant de le mettre à jour
    console.log(`[CLAIM_DB] Vérification de l'existence de l'airdrop dans la base de données`);
    const checkResult = await query(
      `SELECT ar.*, a.token_id, a.token_name, a.token_symbol, a.treasury_id, a.created_at
       FROM airdrop_recipients ar
       JOIN airdrops a ON ar.airdrop_id = a.id
       WHERE ar.account_id = $1 AND ar.airdrop_id = $2`,
      [accountId, airdropId]
    );
    
    console.log(`[CLAIM_DB] Vérification de l'airdrop : ${checkResult.rowCount} enregistrements trouvés`);
    
    if (checkResult.rowCount === 0) {
      console.error(`[CLAIM_DB] ❌ Aucun enregistrement trouvé pour le compte ${accountId} et l'airdrop ${airdropId}`);
      return {
        success: false,
        message: 'Aucun airdrop trouvé pour cette combinaison de compte et d\'ID'
      };
    }
    
    // Afficher les détails de l'airdrop pour le débogage
    const airdropDetails = checkResult.rows[0];
    console.log(`[CLAIM_DB] 📋 Détails de l'airdrop trouvé:
ID Airdrop: ${airdropId}
Compte: ${accountId}
Token ID: ${airdropDetails.token_id || 'Non spécifié'}
Token Name: ${airdropDetails.token_name || 'Non spécifié'}
Token Symbol: ${airdropDetails.token_symbol || 'Non spécifié'}
Treasury ID: ${airdropDetails.treasury_id || 'Non spécifié'}
Montant: ${airdropDetails.amount || 'Non spécifié'}
Créé le: ${airdropDetails.created_at || 'Date inconnue'}
Déjà réclamé: ${airdropDetails.claimed ? 'Oui' : 'Non'}
Date de réclamation: ${airdropDetails.claimed_at || 'Non réclamé'}
`);
    
    // Si l'airdrop est déjà réclamé
    if (airdropDetails.claimed) {
      console.log(`[CLAIM_DB] ⚠️ L'airdrop ${airdropId} est déjà marqué comme réclamé le ${airdropDetails.claimed_at}`);
      return {
        success: true,
        message: 'Airdrop déjà réclamé précédemment',
        alreadyClaimed: true,
        tokenId: airdropDetails.token_id,
        tokenName: airdropDetails.token_name,
        tokenSymbol: airdropDetails.token_symbol || '',
        treasuryId: airdropDetails.treasury_id || null,
        amount: airdropDetails.amount,
        claimedAt: airdropDetails.claimed_at
      };
    }
    
    // Procéder à la mise à jour
    console.log(`[CLAIM_DB] 🔄 Mise à jour de l'airdrop ${airdropId} pour le marquer comme réclamé`);
    
    const timestamp = new Date().toISOString();
    const result = await query(
      `UPDATE airdrop_recipients
       SET claimed = TRUE, claimed_at = NOW()
       WHERE account_id = $1 AND airdrop_id = $2
       RETURNING id, amount`,
      [accountId, airdropId]
    );
    
    console.log(`[CLAIM_DB] Résultat de la mise à jour : ${result.rowCount} lignes affectées`);
    
    if (result.rowCount > 0) {
      console.log(`[CLAIM_DB] ✅ Airdrop ${airdropId} marqué comme réclamé avec succès à ${timestamp}`);
      return {
        success: true,
        message: 'Airdrop marqué comme réclamé',
        tokenId: airdropDetails.token_id,
        tokenName: airdropDetails.token_name,
        tokenSymbol: airdropDetails.token_symbol || '',
        treasuryId: airdropDetails.treasury_id || null,
        amount: airdropDetails.amount,
        claimedAt: timestamp
      };
    } else {
      console.error(`[CLAIM_DB] ❌ Échec de la mise à jour pour l'airdrop ${airdropId}`);
      return {
        success: false,
        message: 'Aucune ligne mise à jour lors du marquage comme réclamé'
      };
    }
  } catch (error) {
    console.error(`[CLAIM_DB] ❌ Erreur lors du marquage de l'airdrop ${airdropId} comme réclamé:`, error);
    console.error('[CLAIM_DB] Stack trace:', error.stack);
    return {
      success: false,
      message: `Erreur de base de données: ${error.message}`
    };
  }
}

module.exports = {
  storeAirdrop,
  getAvailableAirdropsForAccount,
  markAirdropAsClaimed
};