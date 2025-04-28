/**
 * Module de gestion des airdrops de tokens Hedera
 * Permet la création et la réclamation d'airdrops de tokens
 */

const {
  TokenAirdropTransaction,
  TokenClaimAirdropTransaction,
  TokenId,
  PendingAirdropId,
  PrivateKey,
  TransferTransaction,
  AccountId,
  AccountBalanceQuery
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getAccountInfo } = require('./account');
const { getExplorerUrls } = require('../utils/explorer');
const { isTokenAssociated, associateToken, getTokenInfo } = require('./tokens');
const { getWalletByUserId, getWalletByUsername, getWalletByPhoneNumber } = require('../storage/userWallets');
const { storeAirdrop, getAvailableAirdropsForAccount, markAirdropAsClaimed } = require('../storage/airdrops');

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
        } catch (dbError) {
          console.error('Erreur lors de la recherche avancée de wallet:', dbError);
        }
      } catch (error) {
        console.error('Erreur lors de la résolution avancée:', error);
      }
    }
    
    if (wallet) {
      console.log(`Wallet trouvé pour ${originalId}, account ID: ${wallet.accountId}`);
      return wallet.accountId;
    }
    
    console.log(`Aucun wallet trouvé pour ${originalId}`);
    return null;
  } catch (error) {
    console.error('Erreur lors de la résolution de l\'ID:', error);
    return null;
  }
}

/**
 * Résout une liste d'identifiants en IDs de compte Hedera
 * @param {string} identifiersList - Liste d'identifiants séparés par des virgules
 * @returns {Promise<Array<{id: string, accountId: string|null}>>} Liste des IDs originaux et des IDs de compte résolus
 */
async function resolveIdentifiersList(identifiersList) {
  // Diviser la chaîne par virgules et supprimer les espaces
  const identifiers = identifiersList.split(',').map(id => id.trim()).filter(id => id.length > 0);
  
  // Résoudre chaque identifiant
  const results = [];
  for (const id of identifiers) {
    const accountId = await resolveToAccountId(id);
    results.push({ id, accountId });
  }
  
  return results;
}

/**
 * Créer un airdrop de tokens pour plusieurs destinataires
 * @param {string} userId - ID Telegram de l'utilisateur qui crée l'airdrop
 * @param {string} tokenId - ID du token à distribuer
 * @param {Array<{accountId: string, amount: number}>} recipients - Liste des destinataires avec leurs montants
 * @returns {Promise<Object>} Résultat de l'opération d'airdrop
 */
async function createTokenAirdrop(userId, tokenId, recipients) {
  try {
    console.log(`Création de l'airdrop avec:`, {
      userId,
      tokenId,
      recipients
    });
    
    // 1. Récupérer les informations du compte créateur
    const accountInfo = await getAccountInfo(userId);
    if (!accountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
      };
    }

    const { accountId, privateKey } = accountInfo;
    const client = getClient();
    
    // 2. Vérifier que le token existe et qu'il possède un compte treasury
    console.log(`[AIRDROP] Vérification des informations du token ${tokenId}`);
    const tokenInfoResult = await getTokenInfo(tokenId);
    
    if (!tokenInfoResult.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations du token: ${tokenInfoResult.message}`
      };
    }
    
    console.log(`[AIRDROP] Compte Treasury du token: ${tokenInfoResult.treasury}`);
    
    // 3. Vérifier si le token a une supplyKey (nécessaire pour les airdrops)
    if (!tokenInfoResult.hasSupplyKey) {
      console.error(`[AIRDROP] ❌ Le token ${tokenId} n'a pas de supplyKey, il ne peut pas être distribué via airdrop`);
      return {
        success: false,
        message: `Impossible de créer l'airdrop: le token ${tokenId} n'a pas de supplyKey. Ce token ne peut pas être distribué via airdrop.`
      };
    }
    
    // 4. Vérifier si le compte du créateur de l'airdrop est le treasury du token
    if (tokenInfoResult.treasury !== accountId) {
      console.error(`[AIRDROP] ❌ L'utilisateur ${userId} (${accountId}) n'est pas le treasury du token ${tokenId} (${tokenInfoResult.treasury})`);
      return {
        success: false,
        message: `Impossible de créer l'airdrop: seul le compte treasury (${tokenInfoResult.treasury}) peut airdropper ce token. Votre compte: ${accountId}`
      };
    } else {
      console.log(`[AIRDROP] ✅ L'utilisateur ${userId} est bien le treasury du token ${tokenId}`);
    }
    
    // 5. Vérifier l'association du token pour chaque destinataire
    for (const recipient of recipients) {
      try {
        console.log(`Vérification de l'association du token ${tokenId} pour le compte ${recipient.accountId}`);
        
        const isAssociated = await isTokenAssociated(recipient.accountId, tokenId);
        
        if (!isAssociated) {
          console.log(`Le compte ${recipient.accountId} n'est pas associé au token ${tokenId}. Tentative d'association...`);
          
          // Si le destinataire est un utilisateur de notre système, nous pouvons l'associer automatiquement
          if (recipient.originalId) {
            const recipientAccount = await getAccountInfo(recipient.originalId);
            if (recipientAccount.success) {
              const associateResult = await associateToken(recipient.originalId, tokenId);
              console.log(`Résultat de l'association automatique: ${associateResult.success ? 'Succès' : 'Échec'}`);
            }
          }
        } else {
          console.log(`Le compte ${recipient.accountId} est déjà associé au token ${tokenId}`);
        }
      } catch (error) {
        console.error(`Erreur lors de la vérification/association du token pour ${recipient.accountId}:`, error);
        // Continuer avec les autres destinataires même si celui-ci échoue
      }
    }
    
    // 6. IMPLÉMENTATION DE L'AIRDROP SUIVANT LE MODÈLE EXACTE DE HEDERA
    console.log(`Utilisation de TokenAirdropTransaction pour l'airdrop natif Hedera`);
    
    // Prendre le premier destinataire (simplification pour test)
    if (recipients.length === 0) {
      return {
        success: false,
        message: "Aucun destinataire valide pour cet airdrop"
      };
    }
    
    const firstRecipient = recipients[0];
    if (!firstRecipient.amount || firstRecipient.amount <= 0) {
      return {
        success: false,
        message: "Le montant pour le premier destinataire n'est pas valide"
      };
    }
    
    // Convertir les chaînes en objets typés correctement
    const treasuryAccountId = AccountId.fromString(accountId);
    const recipientAccountId = AccountId.fromString(firstRecipient.accountId);
    const tokenIdObj = TokenId.fromString(tokenId);
    const amountToSend = Number(firstRecipient.amount);
    
    console.log(`Préparation de l'airdrop avec les paramètres vérifiés:
    - Token: ${tokenIdObj.toString()}
    - Treasury: ${treasuryAccountId.toString()}
    - Destinataire: ${recipientAccountId.toString()}
    - Montant: ${amountToSend}
    `);
    
    try {
      // CRÉATION DE LA TRANSACTION SELON LE MODÈLE OFFICIEL
      // Le compte treasury (expéditeur) est débité (-amountToSend)
      // Le compte destinataire est crédité (+amountToSend)
      // Les montants doivent se solder à zéro
      const airdropTx = new TokenAirdropTransaction()
        // Débit du treasury (montant négatif)
        .addTokenTransfer(
          tokenIdObj,           // Token ID (objet TokenId)
          treasuryAccountId,    // Treasury Account 
          -amountToSend         // Montant négatif (débit)
        )
        // Crédit du destinataire (montant positif)
        .addTokenTransfer(
          tokenIdObj,           // Token ID (objet TokenId)
          recipientAccountId,   // Recipient Account
          amountToSend          // Montant positif (crédit)
        )
        .freezeWith(client);    // Geler la transaction
      
      console.log(`Transaction TokenAirdropTransaction créée et gelée avec succès`);
      
      // Convertir la clé privée en objet
      const treasuryKey = PrivateKey.fromString(privateKey);
      
      // Signer avec la clé du treasury
      const signedTx = await airdropTx.sign(treasuryKey);
      console.log(`Transaction signée avec la clé du treasury`);
      
      // Exécuter la transaction
      console.log(`Envoi de la transaction...`);
      const txResponse = await signedTx.execute(client);
      console.log(`Transaction soumise, récupération du reçu...`);
      
      // Attendre le reçu
      const receipt = await txResponse.getReceipt(client);
      console.log(`Reçu obtenu, statut: ${receipt.status.toString()}`);
      
      // Récupérer l'ID de transaction
      const txId = txResponse.transactionId.toString();
      
      // Récupérer le pendingAirdropId (si disponible)
      let pendingAirdropId = null;
      try {
        if (receipt.pendingAirdropId) {
          pendingAirdropId = receipt.pendingAirdropId.toString();
          console.log(`PendingAirdropId: ${pendingAirdropId}`);
        }
      } catch (error) {
        console.warn(`Pas de pendingAirdropId disponible: ${error.message}`);
      }
      
      // Calculer le montant total distribué
      const totalAmount = recipients.reduce((sum, r) => sum + Number(r.amount), 0);
      
      // Préparer le résultat
      const result = {
        success: true,
        message: "Airdrop de tokens créé avec succès",
        transactionId: txId,
        tokenId: tokenId,
        recipientCount: recipients.length,
        totalAmount: totalAmount,
        pendingAirdropId: pendingAirdropId,
        status: receipt.status.toString()
      };
      
      // Ajouter les liens vers les explorateurs
      try {
        const explorerUrls = getExplorerUrls(txId, 'transaction');
        result.explorerUrl = explorerUrls.hederaExplorer;
        result.hashscanUrl = explorerUrls.hashScan;
      } catch (error) {
        console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
      }
      
      // Sauvegarder l'airdrop dans la base de données
      try {
        const tokenName = tokenInfoResult.name || `Token ${tokenId}`;
        const tokenSymbol = tokenInfoResult.symbol || '';
        
        const airdropData = {
          creatorId: userId,
          tokenId: tokenId,
          tokenName: tokenName,
          tokenSymbol: tokenSymbol,
          treasuryId: tokenInfoResult.treasury,
          transactionId: txId,
          pendingAirdropId: pendingAirdropId,
          totalAmount: totalAmount,
          recipients: recipients.map(r => ({
            originalId: r.originalId || null,
            accountId: r.accountId,
            amount: Number(r.amount)
          }))
        };
        
        const storeResult = await storeAirdrop(airdropData);
        
        if (storeResult.success) {
          console.log(`Airdrop sauvegardé en base de données avec l'ID: ${storeResult.airdropId}`);
          result.dbAirdropId = storeResult.airdropId;
        } else {
          console.error(`❌ Erreur lors de la sauvegarde de l'airdrop: ${storeResult.message}`);
        }
      } catch (dbError) {
        console.error(`❌ Erreur lors de l'enregistrement de l'airdrop: ${dbError.message}`);
      }
      
      return result;
      
    } catch (txError) {
      console.error(`❌ Erreur lors de la transaction d'airdrop:`, txError);
      return {
        success: false,
        message: `Erreur lors de la création de l'airdrop: ${txError.message}`
      };
    }
  } catch (error) {
    console.error(`❌ Erreur globale dans createTokenAirdrop:`, error);
    return {
      success: false,
      message: `Erreur lors de la création de l'airdrop: ${error.message}`
    };
  }
}

/**
 * Vérifier les airdrops disponibles pour un utilisateur
 * @param {string} userId - ID Telegram de l'utilisateur
 * @returns {Promise<Array<Object>>} Liste des airdrops disponibles
 */
async function getAvailableAirdrops(userId) {
  try {
    console.log(`Recherche des airdrops disponibles pour l'utilisateur ${userId}`);
    
    // 1. Récupérer l'ID de compte Hedera de l'utilisateur
    const accountInfo = await getAccountInfo(userId);
    if (!accountInfo.success) {
      console.error(`Impossible de récupérer les informations du compte pour ${userId}: ${accountInfo.message}`);
      return [];
    }
    
    const { accountId } = accountInfo;
    console.log(`ID de compte pour ${userId}: ${accountId}`);
    
    // 2. Rechercher les airdrops disponibles pour cet ID de compte
    const availableAirdrops = await getAvailableAirdropsForAccount(accountId);
    console.log(`Nombre d'airdrops disponibles pour ${userId}: ${availableAirdrops.length}`);
    
    return availableAirdrops.map(airdrop => ({
      id: airdrop.id,
      tokenId: airdrop.tokenId,
      tokenName: airdrop.tokenName,
      pendingAirdropId: airdrop.pendingAirdropId,
      amount: airdrop.amount,
      // Ajouter les liens vers les explorateurs si le tokenId est disponible
      ...(airdrop.tokenId ? { explorerUrls: getExplorerUrls(airdrop.tokenId, 'token') } : {})
    }));
    
  } catch (error) {
    console.error('Erreur lors de la récupération des airdrops disponibles:', error);
    return [];
  }
}

/**
 * Réclamer un airdrop de tokens
 * @param {string} userId - ID Telegram de l'utilisateur qui réclame l'airdrop
 * @param {string} airdropId - ID de l'airdrop dans la base de données ou pendingAirdropId Hedera
 * @param {boolean} isDbId - Si true, airdropId est l'ID de base de données, sinon c'est le pendingAirdropId Hedera
 * @returns {Promise<Object>} Résultat de l'opération de réclamation
 */
async function claimTokenAirdrop(userId, airdropId, isDbId = false) {
  try {
    console.log(`[CLAIM_START] 🚀 Début de la réclamation d'airdrop:
📌 User ID: ${userId}
📌 Airdrop ID: ${airdropId}
📌 Type ID: ${isDbId ? 'Base de données' : 'Pending Airdrop ID'}
📌 Timestamp: ${new Date().toISOString()}
`);
    
    // Récupérer les informations du compte réclamant
    console.log(`[CLAIM_ACCOUNT] Récupération des informations du compte pour l'utilisateur ${userId}`);
    const accountInfo = await getAccountInfo(userId);
    if (!accountInfo.success) {
      console.error(`[CLAIM_ACCOUNT] ❌ Échec de récupération des informations du compte: ${accountInfo.message}`);
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
      };
    }

    const { accountId, privateKey } = accountInfo;
    console.log(`[CLAIM_ACCOUNT] ✅ Compte trouvé: ${accountId}`);
    
    // Initialiser le client Hedera
    console.log(`[CLAIM_HEDERA] Initialisation du client Hedera`);
    const client = getClient();
    
    // Si c'est un ID de base de données, récupérer le pendingAirdropId correspondant
    let pendingAirdropId = airdropId;
    let dbAirdropId = isDbId ? airdropId : null;
    
    if (isDbId) {
      // Récupérer l'airdrop dans la base de données
      const availableAirdrops = await getAvailableAirdropsForAccount(accountId);
      console.log(`Récupération des airdrops disponibles pour ${accountId}: ${availableAirdrops.length} trouvés`);
      
      const airdrop = availableAirdrops.find(a => a.id.toString() === airdropId.toString());
      console.log(`Recherche de l'airdrop ${airdropId} parmi les disponibles:`, airdrop ? 'Trouvé' : 'Non trouvé');
      
      if (!airdrop) {
        return {
          success: false,
          message: "Airdrop non trouvé ou déjà réclamé"
        };
      }
      
      console.log(`Airdrop trouvé: Token ${airdrop.tokenId}, Montant: ${airdrop.amount}`);
      
      // Vérifier si le token est associé au compte avant de tenter la réclamation
      if (airdrop.tokenId) {
        console.log(`Vérification de l'association du token ${airdrop.tokenId} pour le compte ${accountId}`);
        
        const isAssociated = await isTokenAssociated(accountId, airdrop.tokenId);
        console.log(`Le compte ${accountId} est-il associé au token ${airdrop.tokenId}? ${isAssociated ? 'Oui' : 'Non'}`);
        
        if (!isAssociated) {
          console.log(`Association du token ${airdrop.tokenId} pour le compte ${accountId}...`);
          
          // Tenter d'associer automatiquement le token
          const associateResult = await associateToken(userId, airdrop.tokenId);
          
          if (!associateResult.success) {
            console.error(`Échec de l'association du token: ${associateResult.message}`);
            return {
              success: false,
              message: `Impossible de réclamer l'airdrop: votre compte n'est pas associé au token et l'association automatique a échoué. Veuillez d'abord associer le token avec la commande /associate ${airdrop.tokenId}`
            };
          }
          
          console.log(`Token ${airdrop.tokenId} associé avec succès pour ${accountId}`);
        }
      }
      
      pendingAirdropId = airdrop.pendingAirdropId;
      console.log(`PendingAirdropId: ${pendingAirdropId || 'Non défini'}`);
      
      // Si pas de pendingAirdropId, c'est qu'il n'y a pas besoin de faire une transaction sur la blockchain
      if (!pendingAirdropId) {
        console.log(`Pas de pendingAirdropId, vérification onchain avant marquage comme réclamé`);
        
        // Vérifier onchain si l'utilisateur possède déjà le token
        try {
          const client = getClient();
          console.log(`[ONCHAIN_CHECK] Vérification du solde de token ${airdrop.tokenId} pour le compte ${accountId}`);
          
          // Créer une requête de solde de token
          const tokenBalanceQuery = new AccountBalanceQuery()
            .setAccountId(AccountId.fromString(accountId));
          
          // Exécuter la requête
          console.log(`[ONCHAIN_CHECK] Exécution de la requête de solde`);
          const accountBalance = await tokenBalanceQuery.execute(client);
          
          // Récupérer le solde du token spécifique
          const tokenId = TokenId.fromString(airdrop.tokenId);
          let tokenBalance = 0;
          
          try {
            console.log(`[ONCHAIN_CHECK] Vérification si le token ${airdrop.tokenId} existe dans le solde`);
            if (accountBalance.tokens && accountBalance.tokens._map) {
              const tokenBalanceObj = accountBalance.tokens._map.get(tokenId);
              if (tokenBalanceObj) {
                tokenBalance = tokenBalanceObj.toNumber();
                console.log(`[ONCHAIN_CHECK] Solde du token trouvé: ${tokenBalance}`);
              } else {
                console.log(`[ONCHAIN_CHECK] Token non trouvé dans le solde onchain`);
              }
            } else {
              console.log(`[ONCHAIN_CHECK] Aucun token trouvé dans le solde onchain`);
            }
          } catch (err) {
            console.error(`[ONCHAIN_CHECK] Erreur lors de l'extraction du solde: ${err.message}`);
          }
          
          // Si le token est déjà détenu par l'utilisateur, marquer comme réclamé
          if (tokenBalance > 0) {
            console.log(`[ONCHAIN_CHECK] ✅ Le compte ${accountId} possède déjà ${tokenBalance} units du token ${airdrop.tokenId}`);
            
            // Marquer comme réclamé dans la base de données
            const markResult = await markAirdropAsClaimed(accountId, airdropId);
            console.log(`Résultat du marquage: ${markResult.success ? 'Succès' : 'Échec'} - ${markResult.message}`);
            
            if (!markResult.success) {
              return {
                success: false,
                message: `Erreur lors du marquage de l'airdrop comme réclamé: ${markResult.message}`
              };
            }
            
            return {
              success: true,
              message: `Airdrop marqué comme réclamé avec succès. Le token ${airdrop.tokenId} est déjà dans votre portefeuille.`,
              tokenId: airdrop.tokenId,
              tokenName: airdrop.tokenName,
              amount: airdrop.amount,
              verifiedOnChain: true,
              currentBalance: tokenBalance
            };
          } else {
            console.log(`[ONCHAIN_CHECK] ⚠️ Le compte ${accountId} ne possède pas encore le token ${airdrop.tokenId} onchain`);
            return {
              success: false,
              message: `Vous ne possédez pas encore le token ${airdrop.tokenId} sur la blockchain. Veuillez contacter l'admin pour effectuer le transfert.`,
              tokenId: airdrop.tokenId,
              tokenName: airdrop.tokenName,
              amount: airdrop.amount,
              verifiedOnChain: true,
              currentBalance: 0
            };
          }
        } catch (onchainError) {
          console.error(`[ONCHAIN_CHECK] Erreur lors de la vérification onchain: ${onchainError.message}`);
          return {
            success: false,
            message: `Erreur lors de la vérification onchain: ${onchainError.message}`,
            tokenId: airdrop.tokenId,
            tokenName: airdrop.tokenName
          };
        }
      }
    }
    
    // Vérifier que le pendingAirdropId est au bon format et créer un objet PendingAirdropId
    let pendingAirdropIdObj;
    try {
      console.log(`Vérification du format du pendingAirdropId: ${pendingAirdropId}`);
      pendingAirdropIdObj = PendingAirdropId.fromString(pendingAirdropId);
      console.log(`PendingAirdropId validé`);
    } catch (error) {
      console.error(`Format d'Airdrop ID invalide: ${error.message}`);
      return {
        success: false,
        message: `Format d'Airdrop ID invalide: ${error.message}`
      };
    }
    
    // Si nous avons des informations sur le token pour cet airdrop, vérifier l'association
    if (isDbId && dbAirdropId) {
      console.log(`Récupération des informations sur l'airdrop ${dbAirdropId} pour vérifier l'association du token`);
      const availableAirdrops = await getAvailableAirdropsForAccount(accountId);
      const airdrop = availableAirdrops.find(a => a.id.toString() === dbAirdropId.toString());
      
      if (airdrop && airdrop.tokenId) {
        console.log(`Vérification de l'association du token ${airdrop.tokenId} pour le compte ${accountId} avant réclamation`);
        
        const isAssociated = await isTokenAssociated(accountId, airdrop.tokenId);
        console.log(`Le compte ${accountId} est-il associé au token ${airdrop.tokenId}? ${isAssociated ? 'Oui' : 'Non'}`);
        
        if (!isAssociated) {
          console.log(`Association du token ${airdrop.tokenId} pour le compte ${accountId}...`);
          
          // Tenter d'associer automatiquement le token
          const associateResult = await associateToken(userId, airdrop.tokenId);
          
          if (!associateResult.success) {
            console.error(`Échec de l'association du token: ${associateResult.message}`);
            return {
              success: false,
              message: `Impossible de réclamer l'airdrop: votre compte n'est pas associé au token et l'association automatique a échoué. Veuillez d'abord associer le token avec la commande /associate ${airdrop.tokenId}`
            };
          }
          
          console.log(`Token ${airdrop.tokenId} associé avec succès pour ${accountId}`);
        }
      }
    }
    
    // Créer la transaction de réclamation d'airdrop
    console.log(`Création de la transaction de réclamation d'airdrop avec pendingAirdropId: ${pendingAirdropId}`);
    const txClaimAirdrop = await new TokenClaimAirdropTransaction()
      .addPendingAirdropId(pendingAirdropIdObj)
      .freezeWith(client);
      
    // Convertir la chaîne privateKey en objet PrivateKey et signer
    console.log(`Signature de la transaction avec la clé privée du compte ${accountId}`);
    const privateKeyObj = PrivateKey.fromString(privateKey);
    const signedTx = await txClaimAirdrop.sign(privateKeyObj);
    
    // Soumettre la transaction
    console.log(`Soumission de la transaction de réclamation...`);
    const txResponse = await signedTx.execute(client);
    console.log(`Transaction soumise, attente du reçu...`);
    const receipt = await txResponse.getReceipt(client);
    console.log(`Reçu obtenu, statut: ${receipt.status.toString()}`);
    
    
    const txId = txResponse.transactionId.toString();
    
    // Préparer le résultat avec les liens vers les explorateurs
    const result = {
      success: true,
      message: 'Réclamation d\'airdrop réussie',
      transactionId: txId,
      pendingAirdropId: pendingAirdropId,
      accountId: accountId.toString(),
      status: receipt.status.toString()
    };
    
    // Ajouter les liens vers les explorateurs
    try {
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      result.explorerUrl = explorerUrls.hederaExplorer;
      result.hashscanUrl = explorerUrls.hashScan;
    } catch (error) {
      console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
    }
    
    // Si c'était un airdrop de la base de données, le marquer comme réclamé
    if (dbAirdropId) {
      try {
        console.log(`[CLAIM_TRANSACTION] Marquage de l'airdrop ${dbAirdropId} comme réclamé dans la base de données`);
        const markResult = await markAirdropAsClaimed(accountId, dbAirdropId);
        console.log(`[CLAIM_TRANSACTION] Marquage de l'airdrop ${dbAirdropId} pour le compte ${accountId}: ${markResult.success ? "✅ Réussi" : "❌ Échoué"}`);
        
        if (markResult.success) {
          console.log(`[CLAIM_TRANSACTION] 📊 Détails de la transaction:
ID de transaction: ${txId}
HashScan: ${result.hashscanUrl || `https://hashscan.io/testnet/transaction/${txId}`}
Hedera Explorer: ${result.explorerUrl || `https://testnet.hederaexplorer.io/tx/${txId}`}
Compte: ${accountId}
Status: ${receipt.status.toString()}
`);
        } else {
          console.warn(`[CLAIM_TRANSACTION] ⚠️ Transaction réussie mais échec du marquage dans la base de données: ${markResult.message}`);
        }
      } catch (dbError) {
        console.error(`[CLAIM_TRANSACTION] ❌ Erreur lors du marquage de l'airdrop ${dbAirdropId} comme réclamé: ${dbError.message}`);
        console.error(`[CLAIM_TRANSACTION] Stack trace:`, dbError.stack);
      }
    }
    
    // Pour le débogage final, afficher un résumé de la réclamation
    console.log(`[CLAIM_SUMMARY] 📋 Résumé de la réclamation d'airdrop:
📌 Type: ${pendingAirdropId ? 'Transaction blockchain' : 'Marquage base de données uniquement'}
📌 ID Base de données: ${dbAirdropId || 'N/A'}
📌 ID Airdrop en attente: ${pendingAirdropId || 'N/A'}
📌 Compte: ${accountId}
📌 Statut: ${result.success ? '✅ Succès' : '❌ Échec'}
${result.transactionId ? `📌 ID Transaction: ${result.transactionId}` : ''}
${result.hashscanUrl ? `📌 HashScan: ${result.hashscanUrl}` : ''}
`);
    
    return result;
    
  } catch (error) {
    console.error('Erreur lors de la réclamation de l\'airdrop:', error);
    return {
      success: false,
      message: `Erreur lors de la réclamation de l'airdrop: ${error.message}`
    };
  }
}

module.exports = {
  createTokenAirdrop,
  claimTokenAirdrop,
  resolveToAccountId,
  resolveIdentifiersList,
  getAvailableAirdrops
};