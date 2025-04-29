/**
 * Module de gestion des airdrops de tokens Hedera
 * Implémente les fonctionnalités d'airdrop et de claim en utilisant
 * TokenAirdropTransaction et TokenClaimAirdropTransaction de l'API Hedera
 */

const {
  TokenAirdropTransaction,
  TokenClaimAirdropTransaction,
  TokenId,
  PendingAirdropId,
  PrivateKey,
  AccountId,
  AccountBalanceQuery,
  Hbar,
  Client
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getAccountInfo } = require('./account');
const { getExplorerUrls } = require('../utils/explorer');
const { isTokenAssociated, getTokenInfo } = require('./tokens');
const { getWalletByUserId, getWalletByUsername, getWalletByPhoneNumber, getWalletByAccountId } = require('../storage/userWallets');
const { storeAirdrop, getAvailableAirdropsForAccount, markAirdropAsClaimed } = require('../storage/airdrops');
const { resolveToAccountId } = require('../utils/identifiers');

/**
 * Obtient un client Hedera configuré avec le compte treasury comme opérateur
 * @param {string} treasuryId - ID du compte treasury
 * @returns {Promise<Client|null>} - Client Hedera configuré ou null en cas d'erreur
 */
async function getTreasuryClient(treasuryId) {
  try {
    console.log(`[TREASURY_CLIENT] Configuration du client pour le treasury ${treasuryId}`);
    
    // Si le treasury est notre compte principal, utiliser les clés du fichier .env
    if (process.env.HEDERA_ACCOUNT_ID && treasuryId === process.env.HEDERA_ACCOUNT_ID) {
      console.log(`[TREASURY_CLIENT] Le treasury est notre compte principal, utilisation des clés du fichier .env`);
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;
      
      if (!accountId || !privateKey) {
        console.error('[TREASURY_CLIENT] Variables d\'environnement HEDERA_ACCOUNT_ID ou HEDERA_PRIVATE_KEY manquantes');
        return null;
      }
      
      return Client.forTestnet().setOperator(accountId, privateKey);
    }
    
    // Vérifier si le treasury est un portefeuille utilisateur dans notre base de données
    console.log(`[TREASURY_CLIENT] Recherche du treasury ${treasuryId} dans les portefeuilles utilisateurs`);
    const treasuryWallet = await getWalletByAccountId(treasuryId);
    
    if (treasuryWallet) {
      console.log(`[TREASURY_CLIENT] Treasury trouvé dans les portefeuilles utilisateurs: ${treasuryWallet.user_id}`);
      const accountId = treasuryWallet.account_id;
      const privateKey = treasuryWallet.private_key;
      
      return Client.forTestnet().setOperator(accountId, privateKey);
    }
    
    // Par défaut, utiliser le client principal
    console.log(`[TREASURY_CLIENT] Treasury non trouvé dans les portefeuilles, utilisation du client principal`);
    return getClient();
  } catch (error) {
    console.error(`[TREASURY_CLIENT] Erreur lors de la configuration du client pour le treasury ${treasuryId}:`, error);
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
    console.log(`[AIRDROP] Création d'un airdrop avec:`, {
      userId,
      tokenId,
      recipients: recipients.length
    });
    
    // Vérifier le format du token ID (doit être au format 0.0.X)
    if (!tokenId.match(/^\d+\.\d+\.\d+$/)) {
      console.error(`[AIRDROP] Format d'ID de token invalide: ${tokenId}. Le format attendu est 0.0.X`);
      return {
        success: false,
        message: `Format d'ID de token invalide: ${tokenId}. Le format attendu est 0.0.X (par exemple 0.0.12345)`
      };
    }
    
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
      console.error(`[AIRDROP] Le token ${tokenId} n'a pas de supplyKey, il ne peut pas être distribué via airdrop`);
      return {
        success: false,
        message: `Impossible de créer l'airdrop: le token ${tokenId} n'a pas de supplyKey. Ce token ne peut pas être distribué via airdrop.`
      };
    }
    
    // 4. Vérifier si le compte du créateur de l'airdrop est le treasury du token
    if (tokenInfoResult.treasury !== accountId) {
      console.error(`[AIRDROP] L'utilisateur ${userId} (${accountId}) n'est pas le treasury du token ${tokenId} (${tokenInfoResult.treasury})`);
      return {
        success: false,
        message: `Impossible de créer l'airdrop: seul le compte treasury (${tokenInfoResult.treasury}) peut airdropper ce token. Votre compte: ${accountId}`
      };
    } else {
      console.log(`[AIRDROP] L'utilisateur ${userId} est bien le treasury du token ${tokenId}`);
    }
    
    // 5. Vérifier qu'il y a des destinataires valides
    if (recipients.length === 0) {
      return {
        success: false,
        message: "Aucun destinataire valide pour cet airdrop"
      };
    }
    
    // Validation des montants pour tous les destinataires
    for (const recipient of recipients) {
      if (!recipient.amount || recipient.amount <= 0) {
        return {
          success: false,
          message: `Montant invalide pour le destinataire ${recipient.accountId}: ${recipient.amount}. Le montant doit être positif.`
        };
      }
    }
    
    // Vérifier le solde HBAR du compte treasury
    try {
      console.log(`[AIRDROP] Vérification du solde HBAR de ${accountId}`);
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(accountId);
        
      const balance = await balanceQuery.execute(client);
      const hbarBalance = balance.hbars.toTinybars().toNumber() / 100_000_000;
      
      console.log(`[AIRDROP] Solde HBAR du compte treasury: ${hbarBalance} HBAR`);
      
      // Vérifier si le solde est suffisant pour une transaction standard
      const minimumRequiredBalance = 0.5; // 0.5 HBAR minimum (pour couvrir les frais d'auto-association)
      
      if (hbarBalance < minimumRequiredBalance) {
        console.error(`[AIRDROP] Le solde du compte treasury (${hbarBalance} HBAR) est insuffisant. Un minimum de ${minimumRequiredBalance} HBAR est nécessaire.`);
        
        return {
          success: false,
          message: `Solde HBAR insuffisant (${hbarBalance} HBAR) pour créer cet airdrop. Veuillez recharger votre compte avec au moins ${minimumRequiredBalance} HBAR avant de réessayer.`,
          errorType: 'INSUFFICIENT_BALANCE',
          currentBalance: hbarBalance,
          requiredBalance: minimumRequiredBalance
        };
      }
    } catch (balanceErr) {
      console.error(`[AIRDROP] Erreur lors de la vérification du solde: ${balanceErr.message}`);
    }
    
    // 6. Préparation des objets pour la transaction TokenAirdropTransaction
    const treasuryAccountId = AccountId.fromString(accountId);
    const tokenIdObj = TokenId.fromString(tokenId);
    const totalAmount = recipients.reduce((total, r) => total + Number(r.amount), 0);
    
    console.log(`[AIRDROP] Préparation de l'airdrop avec les paramètres:
    - Token: ${tokenIdObj.toString()}
    - Treasury: ${treasuryAccountId.toString()}
    - Nombre de destinataires: ${recipients.length}
    - Montant total: ${totalAmount}
    `);
    
    try {
      // 7. Création de la transaction TokenAirdropTransaction
      console.log(`[AIRDROP] Création de la transaction TokenAirdropTransaction`);
      const transaction = new TokenAirdropTransaction();
      
      // Configurer la transaction avec le montant total à débiter du compte treasury
      transaction.addTokenTransfer(tokenIdObj, treasuryAccountId, -totalAmount);
      
      // Ajouter chaque destinataire individuellement
      for (const recipient of recipients) {
        const recipientAccountId = AccountId.fromString(recipient.accountId);
        const amount = Number(recipient.amount);
        
        console.log(`[AIRDROP] Ajout du destinataire ${recipientAccountId.toString()} avec montant ${amount}`);
        transaction.addTokenTransfer(tokenIdObj, recipientAccountId, amount);
      }
      
      // Finaliser la transaction
      transaction
        .setTransactionMemo(`Token Airdrop: ${tokenInfoResult.symbol || tokenId}`)
        .setMaxTransactionFee(new Hbar(4)) // Augmenter les frais pour couvrir les auto-associations
        .freezeWith(client);
      
      console.log(`[AIRDROP] Signature de la transaction`);
      
      // Convertir la clé privée du treasury
      const treasuryKey = PrivateKey.fromString(privateKey);
      
      // Signer avec la clé du compte treasury
      const signedTx = await transaction.sign(treasuryKey);
      
      console.log(`[AIRDROP] Soumission de la transaction signée`);
      
      // Soumettre la transaction
      const txResponse = await signedTx.execute(client);
      
      // Attendre la réception de la transaction
      console.log(`[AIRDROP] Attente de la réception...`);
      const receipt = await txResponse.getReceipt(client);
      
      console.log(`[AIRDROP] Statut de la transaction: ${receipt.status.toString()}`);
      
      // Vérifier le succès de la transaction
      if (receipt.status.toString() === "SUCCESS") {
        // Récupérer les IDs des airdrops en attente si présents dans le reçu
        const pendingAirdropIds = [];
        if (receipt.pendingAirdropIds && receipt.pendingAirdropIds.length > 0) {
          console.log(`[AIRDROP] Des airdrops en attente ont été créés: ${receipt.pendingAirdropIds.length}`);
          receipt.pendingAirdropIds.forEach(pendingId => {
            pendingAirdropIds.push(pendingId.toString());
          });
        }
        
        // Générer les URLs d'explorateur
        const explorerUrls = getExplorerUrls(txResponse.transactionId.toString());
        
        // Stocker les airdrops dans la base de données
        const airdropResults = [];
        
        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          const pendingId = pendingAirdropIds[i] || null;
          
          // Déterminer le statut en fonction de l'existence d'un ID d'airdrop en attente
          const status = pendingId ? 'pending' : 'completed';
          
          // Stocker l'airdrop dans la base de données
          const airdropData = {
            tokenId: tokenId,
            tokenName: tokenInfoResult.name || 'Unknown',
            tokenSymbol: tokenInfoResult.symbol || 'UNKNOWN',
            creatorId: userId,  // Champ requis pour la base de données
            senderUserId: userId,
            senderAccountId: accountId,
            recipientAccountId: recipient.accountId,
            amount: Number(recipient.amount),
            totalAmount: Number(recipient.amount), // Nécessaire pour la BD
            treasuryId: tokenInfoResult.treasury || accountId,
            transactionId: txResponse.transactionId.toString(),
            pendingAirdropId: pendingId,
            status: status
          };
          
          try {
            const storedAirdrop = await storeAirdrop(airdropData);
            console.log(`[AIRDROP] Airdrop stocké en base de données avec ID ${storedAirdrop.id}, statut: ${status}`);
            
            airdropResults.push({
              id: storedAirdrop.id,
              recipientId: recipient.accountId,
              amount: recipient.amount,
              status: status,
              pendingAirdropId: pendingId,
              needsClaim: !!pendingId
            });
          } catch (dbErr) {
            console.error(`[AIRDROP] Erreur lors du stockage de l'airdrop en base de données:`, dbErr);
          }
        }
        
        return {
          success: true,
          message: `Airdrop réalisé avec succès pour ${recipients.length} destinataire(s).${pendingAirdropIds.length > 0 ? ' Certains destinataires doivent réclamer leurs tokens.' : ''}`,
          transactionId: txResponse.transactionId.toString(),
          pendingAirdropIds: pendingAirdropIds,
          tokenId: tokenId,
          explorerUrls: explorerUrls,
          airdrops: airdropResults
        };
      } else {
        return {
          success: false,
          message: `La transaction d'airdrop a échoué avec le statut: ${receipt.status.toString()}`,
          transactionId: txResponse.transactionId.toString(),
          explorerUrls: getExplorerUrls(txResponse.transactionId.toString())
        };
      }
    } catch (error) {
      console.error(`[AIRDROP] Erreur lors de la création de l'airdrop:`, error);
      
      // Analyser l'erreur pour fournir un message plus précis
      let errorMessage = `Erreur lors de la création de l'airdrop: ${error.message}`;
      
      // Détecter les erreurs courantes
      if (error.message.includes("TOKEN_NOT_ASSOCIATED_TO_ACCOUNT")) {
        errorMessage = `Un ou plusieurs comptes destinataires n'ont pas associé le token ${tokenId}. Les comptes qui ont des slots d'auto-association disponibles recevront automatiquement les tokens. Les autres devront réclamer leurs tokens manuellement.`;
      } else if (error.message.includes("INSUFFICIENT_PAYER_BALANCE")) {
        errorMessage = `Solde HBAR insuffisant pour couvrir les frais de transaction et d'auto-association. Veuillez recharger votre compte avec plus de HBAR.`;
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  } catch (globalError) {
    console.error(`[AIRDROP] Erreur globale dans createTokenAirdrop:`, globalError);
    return {
      success: false,
      message: `Une erreur est survenue lors de la création de l'airdrop: ${globalError.message}`,
      error: globalError.message
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
    // Récupérer les informations du compte
    const accountInfo = await getAccountInfo(userId);
    if (!accountInfo.success) {
      console.error(`[GET_AIRDROPS] Impossible de récupérer les informations du compte pour ${userId}: ${accountInfo.message}`);
      return [];
    }
    
    // Récupérer les airdrops disponibles en base de données
    console.log(`[GET_AIRDROPS] Récupération des airdrops disponibles pour ${userId} (${accountInfo.accountId})`);
    return await getAvailableAirdropsForAccount(accountInfo.accountId);
  } catch (error) {
    console.error(`[GET_AIRDROPS] Erreur lors de la récupération des airdrops disponibles:`, error);
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
    console.log(`[CLAIM] Début de la réclamation d'airdrop:
    - User ID: ${userId}
    - Airdrop ID: ${airdropId}
    - Type ID: ${isDbId ? 'Base de données' : 'Pending Airdrop ID'}
    - Timestamp: ${new Date().toISOString()}
    `);
    
    // Récupérer les informations du compte réclamant
    console.log(`[CLAIM] Récupération des informations du compte pour l'utilisateur ${userId}`);
    const accountInfo = await getAccountInfo(userId);
    
    if (!accountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
      };
    }
    
    const { accountId, privateKey } = accountInfo;
    const client = getClient();
    
    // Si l'ID est celui de la base de données, récupérer les informations complètes de l'airdrop
    let pendingAirdropId;
    let tokenId;
    let senderAccountId;
    let amount;
    let dbAirdropId;
    
    if (isDbId) {
      console.log(`[CLAIM] Recherche de l'airdrop dans la base de données avec ID ${airdropId}`);
      
      // Récupérer l'airdrop depuis la base de données
      const { query } = require('../storage/db');
      const airdropResult = await query(
        'SELECT * FROM airdrops WHERE id = $1 AND recipient_account_id = $2 AND status = $3',
        [airdropId, accountId, 'pending']
      );
      
      if (!airdropResult || !airdropResult.rows || airdropResult.rows.length === 0) {
        return {
          success: false,
          message: `Airdrop introuvable ou déjà réclamé: ID ${airdropId}`
        };
      }
      
      const airdrop = airdropResult.rows[0];
      
      console.log(`[CLAIM] Airdrop trouvé en base de données:`, airdrop);
      
      pendingAirdropId = airdrop.pending_airdrop_id;
      tokenId = airdrop.token_id;
      senderAccountId = airdrop.sender_account_id;
      amount = airdrop.amount;
      dbAirdropId = airdrop.id;
      
      if (!pendingAirdropId) {
        return {
          success: false,
          message: `Cet airdrop ne nécessite pas de réclamation manuelle. Il a peut-être déjà été transféré automatiquement.`
        };
      }
    } else {
      // L'ID fourni est directement l'ID d'airdrop en attente Hedera
      pendingAirdropId = airdropId;
      
      // Vérifier si cet airdrop est enregistré dans notre base de données
      const { query } = require('../storage/db');
      const airdropResult = await query(
        'SELECT * FROM airdrops WHERE pending_airdrop_id = $1 AND recipient_account_id = $2 AND status = $3',
        [pendingAirdropId, accountId, 'pending']
      );
      
      if (airdropResult && airdropResult.rows && airdropResult.rows.length > 0) {
        const airdrop = airdropResult.rows[0];
        console.log(`[CLAIM] Airdrop correspondant trouvé en base de données:`, airdrop);
        
        tokenId = airdrop.token_id;
        senderAccountId = airdrop.sender_account_id;
        amount = airdrop.amount;
        dbAirdropId = airdrop.id;
      } else {
        console.log(`[CLAIM] Aucun airdrop en base de données pour pendingAirdropId: ${pendingAirdropId}`);
      }
    }
    
    // Vérifier le solde HBAR du compte réclamant
    try {
      console.log(`[CLAIM] Vérification du solde HBAR de ${accountId}`);
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(accountId);
        
      const balance = await balanceQuery.execute(client);
      const hbarBalance = balance.hbars.toTinybars().toNumber() / 100_000_000;
      
      console.log(`[CLAIM] Solde HBAR du compte réclamant: ${hbarBalance} HBAR`);
      
      // Vérifier si le solde est suffisant pour une transaction standard
      const minimumRequiredBalance = 0.1; // 0.1 HBAR minimum
      
      if (hbarBalance < minimumRequiredBalance) {
        console.error(`[CLAIM] Le solde du compte (${hbarBalance} HBAR) est insuffisant. Un minimum de ${minimumRequiredBalance} HBAR est nécessaire.`);
        
        return {
          success: false,
          message: `Solde HBAR insuffisant (${hbarBalance} HBAR) pour réclamer cet airdrop. Veuillez recharger votre compte avec au moins ${minimumRequiredBalance} HBAR avant de réessayer.`,
          errorType: 'INSUFFICIENT_BALANCE',
          currentBalance: hbarBalance,
          requiredBalance: minimumRequiredBalance
        };
      }
    } catch (balanceErr) {
      console.error(`[CLAIM] Erreur lors de la vérification du solde: ${balanceErr.message}`);
    }
    
    // Création de la transaction TokenClaimAirdropTransaction
    console.log(`[CLAIM] Création de la transaction TokenClaimAirdropTransaction pour pendingAirdropId: ${pendingAirdropId}`);
    
    try {
      // Convertir l'ID d'airdrop en attente en objet PendingAirdropId
      const pendingAirdropIdObj = PendingAirdropId.fromString(pendingAirdropId);
      
      // Créer la transaction de réclamation
      const transaction = new TokenClaimAirdropTransaction()
        .addPendingAirdropId(pendingAirdropIdObj)
        .setMaxTransactionFee(new Hbar(2)) // Augmenter les frais pour garantir le succès
        .freezeWith(client);
      
      console.log(`[CLAIM] Signature de la transaction`);
      
      // Convertir la clé privée
      const claimerKey = PrivateKey.fromString(privateKey);
      
      // Signer avec la clé du réclamant
      const signedTx = await transaction.sign(claimerKey);
      
      console.log(`[CLAIM] Soumission de la transaction signée`);
      
      // Soumettre la transaction
      const txResponse = await signedTx.execute(client);
      
      // Attendre la réception de la transaction
      console.log(`[CLAIM] Attente de la réception...`);
      const receipt = await txResponse.getReceipt(client);
      
      console.log(`[CLAIM] Statut de la transaction: ${receipt.status.toString()}`);
      
      // Générer les URLs d'explorateur
      const explorerUrls = getExplorerUrls(txResponse.transactionId.toString());
      
      // Vérifier le succès de la transaction
      if (receipt.status.toString() === "SUCCESS") {
        // Si nous avons l'ID de l'airdrop en base de données, marquer comme réclamé
        if (dbAirdropId) {
          try {
            await markAirdropAsClaimed(dbAirdropId, txResponse.transactionId.toString());
            console.log(`[CLAIM] Airdrop ${dbAirdropId} marqué comme réclamé avec succès`);
          } catch (dbErr) {
            console.error(`[CLAIM] Erreur lors du marquage de l'airdrop comme réclamé:`, dbErr);
          }
        }
        
        return {
          success: true,
          message: `Airdrop réclamé avec succès${tokenId ? ` (Token: ${tokenId}, Montant: ${amount})` : ''}`,
          transactionId: txResponse.transactionId.toString(),
          airdropId: dbAirdropId || null,
          pendingAirdropId: pendingAirdropId,
          tokenId: tokenId || null,
          amount: amount || null,
          explorerUrls: explorerUrls
        };
      } else {
        return {
          success: false,
          message: `La réclamation d'airdrop a échoué avec le statut: ${receipt.status.toString()}`,
          transactionId: txResponse.transactionId.toString(),
          explorerUrls: explorerUrls
        };
      }
    } catch (error) {
      console.error(`[CLAIM] Erreur lors de la réclamation de l'airdrop:`, error);
      
      // Analyser l'erreur pour fournir un message plus précis
      let errorMessage = `Erreur lors de la réclamation de l'airdrop: ${error.message}`;
      
      // Détecter les erreurs courantes
      if (error.message.includes("INVALID_PENDING_AIRDROP_ID")) {
        errorMessage = `L'ID d'airdrop en attente n'est pas valide ou a déjà été réclamé.`;
      } else if (error.message.includes("INSUFFICIENT_PAYER_BALANCE")) {
        errorMessage = `Solde HBAR insuffisant pour couvrir les frais de transaction. Veuillez recharger votre compte avec plus de HBAR.`;
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  } catch (globalError) {
    console.error(`[CLAIM] Erreur globale dans claimTokenAirdrop:`, globalError);
    return {
      success: false,
      message: `Une erreur est survenue lors de la réclamation de l'airdrop: ${globalError.message}`,
      error: globalError.message
    };
  }
}

module.exports = {
  createTokenAirdrop,
  claimTokenAirdrop,
  resolveIdentifiersList,
  getAvailableAirdrops,
  getTreasuryClient
};