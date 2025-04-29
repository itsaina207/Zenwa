/**
 * Module de gestion des identifiants pour Hedera
 * Permet de convertir différents types d'identifiants en AccountId Hedera
 */

const { getWalletByUserId, getWalletByUsername, getWalletByPhoneNumber, getWalletByAccountId } = require('../storage/userWallets');

/**
 * Convertit un ID Telegram, un numéro de téléphone ou un ID de compte Hedera en ID de compte Hedera
 * @param {string} identifier - ID Telegram, numéro de téléphone ou ID de compte Hedera
 * @returns {Promise<string|null>} ID de compte Hedera ou null si non trouvé
 */
async function resolveToAccountId(identifier) {
  try {
    console.log(`Essai de résolution de l'identifiant: "${identifier}"`);
    // Vérifier si c'est déjà un ID de compte Hedera (format: 0.0.X)
    if (/^\d+\.\d+\.\d+$/.test(identifier)) {
      console.log(`Identifiant reconnu comme un account ID Hedera: ${identifier}`);
      return identifier;
    }
    
    // Si l'identifiant commence par @, le supprimer pour certaines recherches
    let telegramId = identifier;
    let originalId = identifier; // Garder l'identifiant original pour la recherche
    if (telegramId.startsWith('@')) {
      telegramId = telegramId.substring(1);
      console.log(`Identifiant modifié sans @: ${telegramId}`);
    }
    
    // 1. Vérifier si c'est un numéro de téléphone (0xx ou +xx)
    if (identifier.match(/^[0+][0-9\s\-\(\)\.]+$/)) {
      console.log(`Tentative de résolution par numéro de téléphone pour: ${identifier}`);
      const wallet = await getWalletByPhoneNumber(identifier);
      
      if (wallet) {
        console.log(`Wallet trouvé par numéro de téléphone: ${wallet.phoneNumber}`);
        return wallet.accountId;
      }
    }
    
    // 2. Essayer de trouver par ID numérique
    let wallet = await getWalletByUserId(telegramId);
    
    // 3. Si ça échoue et c'est potentiellement un nom d'utilisateur, essayer par nom d'utilisateur
    if (!wallet && (telegramId.match(/[a-zA-Z]/) || originalId.match(/[a-zA-Z]/))) {
      console.log(`Tentative de résolution par nom d'utilisateur pour: ${originalId}`);
      wallet = await getWalletByUsername(originalId);
      
      if (wallet) {
        console.log(`Wallet trouvé par nom d'utilisateur: ${wallet.username}`);
        return wallet.accountId;
      }
    }
    
    if (!wallet) {
      console.log(`Aucun wallet trouvé par méthodes directes pour ${telegramId}, tentatives avancées...`);
      
      // 3. Essayer de résoudre via l'API Telegram
      try {
        const telegramBot = require('../telegram/bot').getBot();
        
        try {
          console.log(`Tentative de résolution via l'API Telegram pour: ${telegramId}`);
          const chatInfo = await telegramBot.getChat(`@${telegramId}`);
          
          if (chatInfo && chatInfo.id) {
            console.log(`ID Telegram résolu via l'API: ${chatInfo.id}`);
            
            // Vérifier si cet ID existe dans la base de données
            const resolvedWallet = await getWalletByUserId(chatInfo.id.toString());
            
            if (resolvedWallet) {
              console.log(`Wallet trouvé pour l'ID résolu ${chatInfo.id}`);
              
              // Mise à jour du nom d'utilisateur si absent
              if (!resolvedWallet.username) {
                const { query } = require('../storage/db');
                await query(
                  'UPDATE user_wallets SET username = $1 WHERE user_id = $2',
                  [telegramId, chatInfo.id.toString()]
                );
                console.log(`Nom d'utilisateur ${telegramId} ajouté au wallet ${chatInfo.id}`);
              }
              
              return resolvedWallet.accountId;
            }
          }
        } catch (telegramError) {
          console.log(`Impossible de résoudre via l'API Telegram: ${telegramError.message}`);
        }
        
        // 4. Recherche avancée dans la base de données
        try {
          const { query } = require('../storage/db');
          // Recherche avec LIKE pour trouver des correspondances partielles
          const searchPatterns = [
            telegramId,                  // Nom d'utilisateur sans @
            `%${telegramId}%`,           // Recherche partielle sur le nom d'utilisateur
            originalId,                  // Identifiant original (avec @ si présent)
            `%${originalId}%`            // Recherche partielle sur l'identifiant original
          ];
          
          // Essayer d'abord dans le champ username
          for (const pattern of searchPatterns) {
            console.log(`Essai de recherche avec pattern dans username: ${pattern}`);
            const sql = "SELECT * FROM user_wallets WHERE username ILIKE $1 LIMIT 1";
            const result = await query(sql, [pattern]);
            
            if (result && result.rows && result.rows.length > 0) {
              console.log(`Trouvé un wallet par username avec pattern "${pattern}": ${result.rows[0].username}`);
              wallet = {
                userId: result.rows[0].user_id,
                accountId: result.rows[0].account_id,
                privateKey: result.rows[0].private_key,
                publicKey: result.rows[0].public_key,
                evmAddress: result.rows[0].evm_address,
                username: result.rows[0].username
              };
              break;
            }
          }
          
          // Si toujours pas trouvé, chercher dans user_id
          if (!wallet) {
            for (const pattern of searchPatterns) {
              console.log(`Essai de recherche avec pattern dans user_id: ${pattern}`);
              const sql = "SELECT * FROM user_wallets WHERE user_id::text ILIKE $1 LIMIT 1";
              const result = await query(sql, [pattern]);
              
              if (result && result.rows && result.rows.length > 0) {
                console.log(`Trouvé un wallet par user_id avec pattern "${pattern}": ${result.rows[0].user_id}`);
                wallet = {
                  userId: result.rows[0].user_id,
                  accountId: result.rows[0].account_id,
                  privateKey: result.rows[0].private_key,
                  publicKey: result.rows[0].public_key,
                  evmAddress: result.rows[0].evm_address,
                  username: result.rows[0].username
                };
                break;
              }
            }
          }
          
          // Si on a trouvé un wallet par recherche avancée, retourner son account_id
          if (wallet) {
            return wallet.accountId;
          }
        } catch (dbError) {
          console.error(`Erreur lors de la recherche avancée: ${dbError.message}`);
        }
      } catch (error) {
        console.error(`Erreur générale lors de la résolution avancée: ${error.message}`);
      }
    }
    
    // Si toujours pas trouvé, retourner null
    console.log(`Aucun wallet trouvé pour l'identifiant: ${identifier}`);
    return null;
  } catch (error) {
    console.error(`Erreur lors de la résolution de l'identifiant ${identifier}: ${error.message}`);
    return null;
  }
}

module.exports = {
  resolveToAccountId
};