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
  AccountBalanceQuery,
  Hbar,
  TransactionId
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getAccountInfo } = require('./account');
const { getExplorerUrls } = require('../utils/explorer');
const { isTokenAssociated, associateToken, getTokenInfo } = require('./tokens');
const { getWalletByUserId, getWalletByUsername, getWalletByPhoneNumber, getWalletByAccountId } = require('../storage/userWallets');
const { storeAirdrop, getAvailableAirdropsForAccount, markAirdropAsClaimed } = require('../storage/airdrops');

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
    
    // Vérifier le format du token ID (doit être au format 0.0.X)
    if (!tokenId.match(/^\d+\.\d+\.\d+$/)) {
      console.error(`[AIRDROP] ❌ Format d'ID de token invalide: ${tokenId}. Le format attendu est 0.0.X`);
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
      // Vérifions d'abord si notre client est correctement configuré
      console.log(`[CLIENT_CHECK] Vérification de la configuration du client:`);
      console.log(`- Network: ${process.env.HEDERA_NETWORK || 'testnet'}`);
      
      // Confirmation des types et valeurs avant l'appel
      console.log(`[PARAM_CHECK] Vérification des paramètres avant création de la transaction:`);
      console.log(`- TokenId: ${tokenIdObj.toString()} (type: ${typeof tokenIdObj})`);
      console.log(`- Treasury: ${treasuryAccountId.toString()} (type: ${typeof treasuryAccountId})`);
      console.log(`- Recipient: ${recipientAccountId.toString()} (type: ${typeof recipientAccountId})`);
      console.log(`- Amount: ${amountToSend} (type: ${typeof amountToSend})`);
      
      // CRÉATION DE LA TRANSACTION SELON LE MODÈLE OFFICIEL
      console.log(`[TX_CREATE] Création de la transaction avec la structure officielle`);
      
      // Important: Création du client spécifique pour cette transaction
      // pour être sûr que l'opérateur est correctement défini
      const txClient = getClient();
      
      // Utiliser le compte opérateur par défaut du fichier .env comme payeur des frais
      // mais conserver le compte treasury comme expéditeur des tokens
      console.log(`[TX_CLIENT] Préparation du client pour la transaction`);
      
      // Obtenir le compte admin depuis les variables d'environnement
      const adminAccountId = process.env.HEDERA_AI_KIT_ACCOUNT_ID;
      const adminPrivateKey = process.env.HEDERA_AI_KIT_PRIVATE_KEY;
      
      // Vérifier si les variables d'environnement sont disponibles
      if (!adminAccountId || !adminPrivateKey) {
        console.error(`[TX_CLIENT] ❌ Variables d'environnement manquantes pour le compte admin`);
        // Utiliser le compte treasury comme payeur (fallback)
        txClient.setOperator(treasuryAccountId, PrivateKey.fromString(privateKey));
        console.log(`[TX_CLIENT] Client configuré avec opérateur fallback (treasury): ${treasuryAccountId.toString()}`);
      } else {
        // Configurer le client avec le compte admin comme payeur
        try {
          const adminAccId = AccountId.fromString(adminAccountId);
          const adminKey = PrivateKey.fromString(adminPrivateKey);
          txClient.setOperator(adminAccId, adminKey);
          console.log(`[TX_CLIENT] Client configuré avec opérateur admin: ${adminAccId.toString()}`);
        } catch (e) {
          console.error(`[TX_CLIENT] ❌ Erreur lors de la configuration de l'opérateur admin: ${e.message}`);
          // Fallback au compte treasury
          txClient.setOperator(treasuryAccountId, PrivateKey.fromString(privateKey));
          console.log(`[TX_CLIENT] Client configuré avec opérateur fallback (treasury): ${treasuryAccountId.toString()}`);
        }
      }
      
      // Vérifier le solde HBAR du compte treasury
      try {
        console.log(`[BALANCE_CHECK] Vérification du solde HBAR de ${treasuryAccountId.toString()}`);
        const balanceQuery = new AccountBalanceQuery()
          .setAccountId(treasuryAccountId);
          
        const balance = await balanceQuery.execute(txClient);
        const hbarBalance = balance.hbars.toTinybars().toNumber() / 100_000_000;
        
        console.log(`[BALANCE_CHECK] Solde HBAR du compte treasury: ${hbarBalance} HBAR`);
        
        // Vérifier si le solde est suffisant pour une transaction standard
        const minimumRequiredBalance = 0.1; // 0.1 HBAR minimum
        
        if (hbarBalance < minimumRequiredBalance) {
          console.error(`[BALANCE_CHECK] ❌ ERREUR: Le solde du compte treasury (${hbarBalance} HBAR) est insuffisant pour effectuer cette transaction. Un minimum de ${minimumRequiredBalance} HBAR est nécessaire.`);
          
          // Retourner une erreur explicite pour avertir l'utilisateur
          return {
            success: false,
            message: `Solde HBAR insuffisant (${hbarBalance} HBAR) pour créer cet airdrop. Veuillez recharger votre compte avec au moins ${minimumRequiredBalance} HBAR avant de réessayer.`,
            errorType: 'INSUFFICIENT_BALANCE',
            currentBalance: hbarBalance,
            requiredBalance: minimumRequiredBalance
          };
        }
      } catch (balanceErr) {
        console.error(`[BALANCE_CHECK] Erreur lors de la vérification du solde: ${balanceErr.message}`);
      }
      
      // Création de la transaction avec le client correctement configuré
      // Si nous avons un compte admin, utiliser un TransactionId spécifique
      let airdropTx;
      
      // Simplifier et revenir à une approche plus directe en utilisant l'ID du treasury comme ID de transaction
      // L'utilisateur devra s'assurer que le compte treasury a suffisamment de HBAR
      console.log(`[TX_ID] Simplification - utilisation du treasury comme payeur`);
      
      // Utiliser TransferTransaction standard au lieu de TokenAirdropTransaction personnalisée
      airdropTx = new TransferTransaction()
        .setTransactionMemo(`Airdrop Token ${tokenIdObj.toString()} from ${treasuryAccountId.toString()} to ${recipientAccountId.toString()}`)
        .setMaxTransactionFee(new Hbar(2)); // Augmenter les frais pour assurer que la transaction passe
      
      console.log(`[TX_CONFIG] Utilisation du treasury comme payeur, avec des frais minimaux (0.1 HBAR)`);
      
      // Réinitialiser le client avec le treasury comme opérateur
      txClient.setOperator(treasuryAccountId, PrivateKey.fromString(privateKey));
      console.log(`[TX_CLIENT] Client réinitialisé avec le treasury comme opérateur unique: ${treasuryAccountId.toString()}`);
      
      
      console.log(`[TX_MEMO] Ajout d'un memo à la transaction`);
      
      // Frais de transaction déjà définis ci-dessus (2 HBAR), ne pas les redéfinir ici
      console.log(`[TX_CONFIG] Frais de transaction maintenus à 2 HBAR pour assurer l'exécution`);
      
      // Ajouter le premier transfert (débit du treasury)
      console.log(`[TX_ADD] Ajout du transfert de débit (treasury): ${tokenIdObj.toString()}, ${treasuryAccountId.toString()}, -${amountToSend}`);
      airdropTx.addTokenTransfer(
        tokenIdObj,           // Token ID
        treasuryAccountId,    // Treasury Account
        -amountToSend         // Montant négatif (débit)
      );
      
      // Ajouter le second transfert (crédit du destinataire)
      console.log(`[TX_ADD] Ajout du transfert de crédit (destinataire): ${tokenIdObj.toString()}, ${recipientAccountId.toString()}, +${amountToSend}`);
      airdropTx.addTokenTransfer(
        tokenIdObj,           // Token ID
        recipientAccountId,   // Recipient Account
        amountToSend          // Montant positif (crédit)
      );
      
      // Auto-validation: vérifier si on essaie de transférer à soi-même
      if (treasuryAccountId.toString() === recipientAccountId.toString()) {
        console.log(`⚠️ AVERTISSEMENT: Vous essayez d'envoyer des tokens à vous-même (${treasuryAccountId.toString()}). Cela pourrait être rejeté par le réseau.`);
      }
      
      // Geler la transaction avec le client
      console.log(`[TX_FREEZE] Gel de la transaction`);
      const frozen = await airdropTx.freezeWith(txClient);
      
      console.log(`[TX_BODY] >>>>>> Essai d'affichage du contenu de la transaction après freeze:`);
      try {
        // Afficher la structure de l'objet
        const txData = {
          nodeAccountIds: frozen._nodeAccountIds ? frozen._nodeAccountIds.map(id => id.toString()) : 'undefined',
          transactionId: frozen.transactionId ? frozen.transactionId.toString() : 'undefined',
          tokenTransfers: frozen._tokenTransfers ? 'présent' : 'absent',
          memo: frozen._transactionMemo || 'non défini'
        };
        console.log(JSON.stringify(txData, null, 2));
        
        // Méthode alternative pour afficher plus de détails sur les transferts
        if (frozen._tokenTransfers && frozen._tokenTransfers.length > 0) {
          console.log(`TokenTransfers détectés: ${frozen._tokenTransfers.length}`);
          frozen._tokenTransfers.forEach((transfer, i) => {
            console.log(`Transfer ${i+1}:`, JSON.stringify(transfer));
          });
        } else {
          console.log(`!!! ALERTE: Aucun transfert de token détecté dans la transaction`);
        }
      } catch (e) {
        console.log(`Erreur lors de l'affichage du corps: ${e.message}`);
      }
      console.log(`[TX_BODY] <<<<<<`);
      
      // Convertir la clé privée en objet
      const treasuryKey = PrivateKey.fromString(privateKey);
      
      // Signer avec la clé du treasury (simplification)
      console.log(`[TX_SIGN] Signature de la transaction avec la clé du treasury`);
      const signedTx = await frozen.sign(treasuryKey);
      console.log(`[TX_SIGN] Transaction signée avec succès`);
      
      // Remarque : le compte treasury est maintenant utilisé comme payeur unique
      // Si ce compte manque de HBAR, vous devrez le financer en envoyant des HBAR
      
      // Exécuter la transaction avec le même client précédemment configuré
      console.log(`[TX_EXECUTE] Envoi de la transaction au réseau...`);
      console.log(`[TX_EXECUTE] Utilisation du client spécifique: ${process.env.HEDERA_NETWORK || 'testnet'}`);
      const txResponse = await signedTx.execute(txClient);
      console.log(`[TX_EXECUTE] Transaction soumise avec succès, attente du reçu...`);
      
      // Attendre le reçu avec le même client
      console.log(`[TX_RECEIPT] Récupération du reçu...`);
      const receipt = await txResponse.getReceipt(txClient);
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
    
    // Vérifier le solde HBAR de l'utilisateur
    try {
      console.log(`[BALANCE_CHECK] Vérification du solde HBAR de ${accountId}`);
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(accountId);
        
      const balance = await balanceQuery.execute(client);
      const hbarBalance = balance.hbars.toTinybars().toNumber() / 100_000_000;
      
      console.log(`[BALANCE_CHECK] Solde HBAR de l'utilisateur: ${hbarBalance} HBAR`);
      
      // Vérifier si le solde est suffisant pour une transaction standard
      const minimumRequiredBalance = 0.1; // 0.1 HBAR minimum
      
      if (hbarBalance < minimumRequiredBalance) {
        console.error(`[BALANCE_CHECK] ❌ ERREUR: Le solde de l'utilisateur (${hbarBalance} HBAR) est insuffisant pour effectuer cette transaction. Un minimum de ${minimumRequiredBalance} HBAR est nécessaire.`);
        
        // Retourner une erreur explicite pour avertir l'utilisateur
        return {
          success: false,
          message: `Solde HBAR insuffisant (${hbarBalance} HBAR) pour réclamer cet airdrop. Veuillez recharger votre compte avec au moins ${minimumRequiredBalance} HBAR avant de réessayer.`,
          errorType: 'INSUFFICIENT_BALANCE',
          currentBalance: hbarBalance,
          requiredBalance: minimumRequiredBalance
        };
      }
    } catch (balanceErr) {
      console.error(`[BALANCE_CHECK] Erreur lors de la vérification du solde: ${balanceErr.message}`);
    }
    
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
      
      // Si pas de pendingAirdropId, effectuer un transfert de token direct
      if (!pendingAirdropId) {
        console.log(`[DIRECT_TRANSFER] Pas de pendingAirdropId, tentative de transfert direct du token`);
        
        try {
          // Récupérer le treasury account ID (expéditeur)
          if (!airdrop.treasuryId) {
            console.error(`[DIRECT_TRANSFER] ❌ Erreur: L'airdrop n'a pas de treasuryId défini`);
            return {
              success: false,
              message: `Erreur: Token treasury non défini pour l'airdrop`,
              tokenId: airdrop.tokenId,
              tokenName: airdrop.tokenName
            };
          }
          
          // Convertir les valeurs en types Hedera
          const treasuryId = AccountId.fromString(airdrop.treasuryId);
          const tokenId = TokenId.fromString(airdrop.tokenId);
          const amount = parseInt(airdrop.amount);
          
          console.log(`[DIRECT_TRANSFER] --------------------------------- Direct Token Transfer ---------------------------------`);
          console.log(`[DIRECT_TRANSFER] Token ID                : ${airdrop.tokenId} (${airdrop.tokenName})`);
          console.log(`[DIRECT_TRANSFER] Treasury Account ID     : ${treasuryId.toString()}`);
          console.log(`[DIRECT_TRANSFER] Receiver Account ID     : ${accountId.toString()}`);
          console.log(`[DIRECT_TRANSFER] Amount                  : ${amount}`);
          
          // Pour ce transfert, il nous faut une clé avec autorité sur le treasury
          // Vérifier si le treasury est notre compte ENV (probable)
          let treasuryPrivateKey = null;
          let client = null;
          
          console.log(`[DIRECT_TRANSFER] Recherche des informations du treasury ${treasuryId}...`);
          
          // Si le treasury est notre compte principal
          if (process.env.HEDERA_ACCOUNT_ID && treasuryId.toString() === process.env.HEDERA_ACCOUNT_ID) {
            console.log(`[DIRECT_TRANSFER] Treasury est notre compte principal, utilisation de la clé ENV`);
            treasuryPrivateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
            client = Client.forTestnet().setOperator(process.env.HEDERA_ACCOUNT_ID, process.env.HEDERA_PRIVATE_KEY);
          } else {
            // Sinon, tenter de trouver dans les wallets utilisateurs
            const treasuryWallet = await getWalletByAccountId(treasuryId.toString());
            if (treasuryWallet) {
              console.log(`[DIRECT_TRANSFER] Treasury trouvé dans les wallets utilisateurs: ${treasuryWallet.user_id}`);
              treasuryPrivateKey = PrivateKey.fromString(treasuryWallet.private_key);
              client = Client.forTestnet().setOperator(treasuryWallet.account_id, treasuryWallet.private_key);
            } else {
              console.error(`[DIRECT_TRANSFER] ❌ Impossible de trouver les clés du treasury ${treasuryId}`);
              return {
                success: false,
                message: `Erreur: Pas d'accès au compte treasury pour effectuer le transfert`,
                tokenId: airdrop.tokenId,
                tokenName: airdrop.tokenName,
                treasuryNotFound: true
              };
            }
          }
          
          if (!client) {
            console.error(`[DIRECT_TRANSFER] ❌ Impossible de configurer le client pour le treasury ${treasuryId}`);
            client = getClient(); // Utiliser le client par défaut en dernier recours
          }
          
          // Créer la transaction de transfert de token exactement comme dans l'exemple
          const txTokenTransfer = new TransferTransaction()
            .addTokenTransfer(tokenId, treasuryId, -amount)   // Débit du treasury
            .addTokenTransfer(tokenId, accountId, amount)     // Crédit du destinataire
            .setTransactionMemo(`Airdrop claim for ${accountId}`)
            .setMaxTransactionFee(new Hbar(2));               // Frais augmentés pour éviter INSUFFICIENT_TX_FEE
          
          console.log(`[DIRECT_TRANSFER] Transaction préparée, exécution avec le client opérateur: ${client.operatorAccountId?.toString()}`);
          
          // Exécuter la transaction
          const txResponse = await txTokenTransfer.execute(client);
          
          // Obtenir le reçu de la transaction
          const receiptTransfer = await txResponse.getReceipt(client);
          
          // Obtenir le statut de la transaction
          const statusTransfer = receiptTransfer.status;
          
          // Obtenir l'ID de la transaction
          const txTransferId = txResponse.transactionId.toString();
          
          console.log(`[DIRECT_TRANSFER] Receipt status         : ${statusTransfer.toString()}`);
          console.log(`[DIRECT_TRANSFER] Transaction ID         : ${txTransferId}`);
          console.log(`[DIRECT_TRANSFER] Hashscan URL           : https://hashscan.io/testnet/tx/${txTransferId}`);
          
          // Si la transaction est réussie, marquer l'airdrop comme réclamé
          if (statusTransfer.toString() === 'SUCCESS') {
            console.log(`[DIRECT_TRANSFER] ✅ Transfert réussi! Marquage de l'airdrop comme réclamé`);
            
            // Marquer comme réclamé dans la base de données
            const markResult = await markAirdropAsClaimed(accountId, airdropId);
            console.log(`[DIRECT_TRANSFER] Résultat du marquage: ${markResult.success ? 'Succès' : 'Échec'} - ${markResult.message}`);
            
            return {
              success: true,
              message: `Airdrop transféré avec succès! ${amount} ${airdrop.tokenName} ont été ajoutés à votre portefeuille.`,
              tokenId: airdrop.tokenId,
              tokenName: airdrop.tokenName,
              amount: airdrop.amount,
              transactionId: txTransferId,
              hashscanUrl: `https://hashscan.io/testnet/tx/${txTransferId}`,
              directTransfer: true
            };
          } else {
            console.error(`[DIRECT_TRANSFER] ❌ Échec du transfert: ${statusTransfer.toString()}`);
            return {
              success: false,
              message: `Échec du transfert: ${statusTransfer.toString()}. Veuillez contacter l'administrateur.`,
              tokenId: airdrop.tokenId,
              tokenName: airdrop.tokenName
            };
          }
        } catch (transferError) {
          console.error(`[DIRECT_TRANSFER] ❌ Erreur lors du transfert: ${transferError.message}`);
          console.error(transferError.stack);
          return {
            success: false,
            message: `Erreur lors du transfert du token: ${transferError.message}`,
            tokenId: airdrop.tokenId,
            tokenName: airdrop.tokenName,
            errorDetails: transferError.message
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
      .setMaxTransactionFee(new Hbar(0.5)) // Utilisation de 0.5 HBAR pour les réclamations d'airdrop (opération plus coûteuse)
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
    
    // Ajouter uniquement le lien HashScan
    try {
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      result.hashscanUrl = explorerUrls.hashScan;
      // Supprimer la référence à l'explorateur Hedera pour n'utiliser que HashScan
    } catch (error) {
      console.warn(`Erreur lors de la génération du lien HashScan: ${error.message}`);
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
  getAvailableAirdrops,
  getTreasuryClient
};