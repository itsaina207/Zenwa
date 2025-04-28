/**
 * Hedera Token Service (HTS) operations
 * Create and manage tokens
 */

const {
  TokenCreateTransaction,
  TokenType,
  TransferTransaction,
  TokenAssociateTransaction,
  AccountBalanceQuery,
  PrivateKey,
  AccountId,
  TokenAirdropTransaction,
  TokenInfoQuery
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getWalletByUserId } = require('../storage/userWallets');
const { HEDERA_NETWORK } = require('../config');

/**
 * Mint a new fungible token
 * @param {string} userId - Telegram user ID of the token creator
 * @param {object} tokenInfo - Token details
 * @returns {Promise<object>} Token creation result
 */
async function mintToken(userId, tokenInfo) {
  try {
    const client = getClient();
    const wallet = await getWalletByUserId(userId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }

    // Default token values if not provided
    let {
      name = `Token-${Date.now()}`,
      symbol = `TKN${Math.floor(Math.random() * 1000)}`,
      decimals = 0,
      initialSupply = 1000,
    } = tokenInfo || {};
    
    // Appliquer la limite maximale pour l'offre initiale
    const MAX_SUPPLY = 100000000; // 100 millions
    if (initialSupply > MAX_SUPPLY) {
      console.warn(`Supply limit exceeded (${initialSupply}), capping to ${MAX_SUPPLY}`);
      initialSupply = MAX_SUPPLY;
    }

    // Create the token transaction
    const transaction = await new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setDecimals(decimals)
      .setInitialSupply(initialSupply)
      .setTokenType(TokenType.FUNGIBLE_COMMON)
      .setTreasuryAccountId(wallet.accountId)
      .setAdminKey(PrivateKey.fromString(wallet.privateKey).publicKey)
      .setSupplyKey(PrivateKey.fromString(wallet.privateKey).publicKey)
      .freezeWith(client);

    // Sign with the account's private key
    const signedTx = await transaction.sign(
      PrivateKey.fromString(wallet.privateKey)
    );

    // Execute the transaction
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    if (receipt.status.toString() !== 'SUCCESS') {
      return {
        success: false,
        message: `Token creation failed with status: ${receipt.status.toString()}`,
      };
    }

    const tokenId = receipt.tokenId.toString();
    const txId = txResponse.transactionId.toString();
    
    // Store token information in the database
    await storeTokenInfo(userId, tokenId, name, symbol);

    return {
      success: true,
      message: `Token created successfully: ${name} (${symbol})`,
      tokenId,
      tokenName: name,
      tokenSymbol: symbol,
      initialSupply: initialSupply || 1000, // Assurer qu'initialSupply n'est jamais undefined ou NaN
      transactionId: txId,
      explorerUrl: `https://hashscan.io/${HEDERA_NETWORK}/tx/${txId}`,
    };
  } catch (error) {
    console.error(`Error creating token: ${error.message}`);
    return {
      success: false,
      message: `Failed to create token: ${error.message}`,
    };
  }
}

/**
 * Transfer tokens from one account to another
 * @param {string} fromUserId - Sender's Telegram user ID
 * @param {string} toAccountId - Recipient's Hedera account ID
 * @param {string} tokenId - ID of the token to transfer
 * @param {number} amount - Amount of tokens to transfer
 * @returns {Promise<object>} Transaction result
 */
async function sendToken(fromUserId, toAccountId, tokenId, amount) {
  try {
    const client = getClient();
    const wallet = await getWalletByUserId(fromUserId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }

    // Validate recipient account
    try {
      AccountId.fromString(toAccountId);
    } catch (e) {
      return {
        success: false,
        message: 'ID de compte destinataire invalide',
      };
    }

    // Validate token ID
    let tokenIdObj;
    try {
      tokenIdObj = tokenId.toString();
    } catch (e) {
      return {
        success: false,
        message: 'ID de token invalide',
      };
    }

    // Validate amount
    if (amount <= 0) {
      return {
        success: false,
        message: 'Le montant doit être supérieur à 0',
      };
    }

    // Create the transfer transaction
    const transaction = new TransferTransaction()
      .addTokenTransfer(tokenIdObj, wallet.accountId, -amount)
      .addTokenTransfer(tokenIdObj, toAccountId, amount)
      .freezeWith(client);
    
    // Sign with the sender's private key
    const signedTx = await transaction.sign(
      PrivateKey.fromString(wallet.privateKey)
    );
    
    // Execute the transaction
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    if (receipt.status.toString() !== 'SUCCESS') {
      return {
        success: false,
        message: `Le transfert de token a échoué avec le statut: ${receipt.status.toString()}`,
      };
    }
    
    const txId = txResponse.transactionId.toString();
    
    return {
      success: true,
      message: `${amount} tokens ont été envoyés avec succès à ${toAccountId}`,
      tokenId: tokenIdObj,
      amount,
      fromAccount: wallet.accountId,
      toAccount: toAccountId,
      transactionId: txId,
      explorerUrl: `https://hashscan.io/${HEDERA_NETWORK}/tx/${txId}`,
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de tokens: ${error.message}`);
    return {
      success: false,
      message: `Échec de l'envoi de tokens: ${error.message}`,
    };
  }
}

/**
 * Store token information in the database
 * @param {string} userId - Telegram user ID
 * @param {string} tokenId - Token ID
 * @param {string} name - Token name
 * @param {string} symbol - Token symbol
 * @returns {Promise<boolean>} Success status
 */
async function storeTokenInfo(userId, tokenId, name, symbol) {
  try {
    const { query } = require('../storage/db');
    
    // Check if the table exists and create it if not
    await query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_id TEXT NOT NULL,
        token_name TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, token_id)
      )
    `);
    
    // Insert the token info
    await query(
      'INSERT INTO user_tokens (user_id, token_id, token_name, token_symbol) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, token_id) DO UPDATE SET token_name = $3, token_symbol = $4',
      [userId, tokenId, name, symbol]
    );
    
    return true;
  } catch (error) {
    console.error(`Error storing token info: ${error.message}`);
    return false;
  }
}

/**
 * Get token ID by name
 * @param {string} userId - Telegram user ID
 * @param {string} nameOrSymbol - Token name or symbol
 * @returns {Promise<string|null>} Token ID or null if not found
 */
async function getTokenIdByNameOrSymbol(userId, nameOrSymbol) {
  try {
    const { query } = require('../storage/db');
    
    // Query tokens by name or symbol
    const result = await query(
      'SELECT token_id FROM user_tokens WHERE user_id = $1 AND (LOWER(token_name) = LOWER($2) OR LOWER(token_symbol) = LOWER($2))',
      [userId, nameOrSymbol]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].token_id;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting token ID by name: ${error.message}`);
    return null;
  }
}

/**
 * Exécuter un transfert forcé d'airdrop de tokens
 * Cette fonction utilise TokenAirdropTransaction pour transférer des tokens même à des comptes non associés
 * en créant un "pending airdrop" que l'utilisateur pourra réclamer plus tard
 * 
 * @param {string} fromUserId - ID Telegram de l'expéditeur (admin ou propriétaire du token)
 * @param {string} toAccountId - ID du compte destinataire Hedera
 * @param {string} tokenId - ID du token à transférer
 * @param {number} amount - Montant de tokens à transférer
 * @returns {Promise<object>} Résultat de l'opération
 */
async function executeAirdropTransfer(fromUserId, toAccountId, tokenId, amount) {
  try {
    console.log(`[AIRDROP_TRANSFER] 🚀 Début du transfert forcé d'airdrop:
      📌 Expéditeur: ${fromUserId}
      📌 Destinataire: ${toAccountId}
      📌 Token: ${tokenId}
      📌 Montant: ${amount}
    `);
    
    const client = getClient();
    const wallet = await getWalletByUserId(fromUserId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé pour l\'expéditeur. Créez-en un d\'abord avec /createwallet',
      };
    }
    
    // Vérifier que le token existe et appartient à l'expéditeur (treasury)
    console.log(`[AIRDROP_TRANSFER] Vérification des informations du token ${tokenId}`);
    try {
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(tokenId)
        .execute(client);
      
      console.log(`[AIRDROP_TRANSFER] Nom du token: ${tokenInfo.name}`);
      console.log(`[AIRDROP_TRANSFER] Symbole: ${tokenInfo.symbol}`);
      console.log(`[AIRDROP_TRANSFER] Compte Treasury: ${tokenInfo.treasuryAccountId.toString()}`);
      
      // Vérifier si l'utilisateur est le propriétaire du token (treasury account)
      if (tokenInfo.treasuryAccountId.toString() !== wallet.accountId) {
        console.log(`[AIRDROP_TRANSFER] ⚠️ L'utilisateur ${fromUserId} (${wallet.accountId}) n'est pas le propriétaire du token ${tokenId} (treasury: ${tokenInfo.treasuryAccountId})`);
        
        // On peut autoriser le transfert quand même, mais avertir que ce n'est pas le treasury
        console.log(`[AIRDROP_TRANSFER] Tentative de transfert malgré que l'utilisateur n'est pas le treasury`);
      } else {
        console.log(`[AIRDROP_TRANSFER] ✅ L'utilisateur ${fromUserId} est bien le propriétaire du token ${tokenId}`);
      }
    } catch (tokenInfoError) {
      console.error(`[AIRDROP_TRANSFER] ❌ Erreur lors de la récupération des informations du token: ${tokenInfoError.message}`);
      // On continue quand même car l'erreur pourrait être due à un manque de permission plutôt qu'à l'inexistence du token
    }
    
    // Vérifier si le token est déjà associé au compte destinataire
    const isAssociated = await isTokenAssociated(toAccountId, tokenId);
    console.log(`[AIRDROP_TRANSFER] Le compte ${toAccountId} est-il associé au token ${tokenId}? ${isAssociated ? 'Oui' : 'Non'}`);
    
    // Utiliser TokenAirdropTransaction si le compte n'est pas associé
    // Cela créera un "pending airdrop" que l'utilisateur pourra réclamer après avoir associé le token
    console.log(`[AIRDROP_TRANSFER] Création d'une transaction ${isAssociated ? 'TransferTransaction' : 'TokenAirdropTransaction'}`);
    
    let transaction;
    let pendingAirdropId = null;
    
    if (!isAssociated) {
      // Utiliser TokenAirdropTransaction pour créer un "pending airdrop"
      console.log(`[AIRDROP_TRANSFER] Préparation d'un airdrop en attente (pending airdrop) pour ${toAccountId}`);
      
      transaction = new TokenAirdropTransaction()
        .setMaxTransactionFee(new Hbar(0.05)) // Limitation des frais à 0.05 HBAR pour éviter INSUFFICIENT_PAYER_BALANCE
        .addTokenTransfer(
          tokenId,
          wallet.accountId, // Compte expéditeur (treasury)
          toAccountId,      // Compte destinataire
          amount            // Montant à transférer
        )
        .freezeWith(client);
    } else {
      // Utiliser TransferTransaction standard pour un transfert direct
      console.log(`[AIRDROP_TRANSFER] Préparation d'un transfert direct pour ${toAccountId}`);
      
      transaction = new TransferTransaction()
        .addTokenTransfer(tokenId, wallet.accountId, -amount)
        .addTokenTransfer(tokenId, toAccountId, amount)
        .freezeWith(client);
    }
    
    // Signer avec la clé privée de l'expéditeur
    console.log(`[AIRDROP_TRANSFER] Signature de la transaction avec la clé privée de ${wallet.accountId}`);
    const privateKey = PrivateKey.fromString(wallet.privateKey);
    const signedTx = await transaction.sign(privateKey);
    
    // Exécuter la transaction
    console.log(`[AIRDROP_TRANSFER] Exécution de la transaction`);
    const txResponse = await signedTx.execute(client);
    console.log(`[AIRDROP_TRANSFER] Transaction soumise, attente du reçu...`);
    const receipt = await txResponse.getReceipt(client);
    
    const txId = txResponse.transactionId.toString();
    console.log(`[AIRDROP_TRANSFER] Transaction terminée: ${txId}`);
    console.log(`[AIRDROP_TRANSFER] Statut: ${receipt.status.toString()}`);
    
    // Pour les TokenAirdropTransaction, récupérer le pendingAirdropId s'il existe
    if (!isAssociated && receipt.pendingAirdropId) {
      pendingAirdropId = receipt.pendingAirdropId.toString();
      console.log(`[AIRDROP_TRANSFER] Pending Airdrop ID: ${pendingAirdropId}`);
    }
    
    // Générer les URLs vers les explorateurs
    const { getExplorerUrls } = require('../utils/explorer');
    const explorerUrls = getExplorerUrls(txId, 'transaction');
    
    // Construire le résultat
    return {
      success: true,
      message: isAssociated 
        ? `✅ ${amount} tokens du token ${tokenId} ont été transférés directement à ${toAccountId}` 
        : `✅ Airdrop de ${amount} tokens du token ${tokenId} créé pour ${toAccountId}. L'utilisateur devra l'associer avant de pouvoir le réclamer.`,
      tokenId,
      amount,
      fromAccount: wallet.accountId,
      toAccount: toAccountId,
      transactionId: txId,
      isPendingAirdrop: !isAssociated,
      pendingAirdropId: pendingAirdropId,
      explorerUrl: explorerUrls.hederaExplorer,
      hashscanUrl: explorerUrls.hashScan
    };
  } catch (error) {
    console.error(`[AIRDROP_TRANSFER] ❌ Erreur lors du transfert d'airdrop: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      message: `Échec du transfert d'airdrop: ${error.message}`,
    };
  }
}

/**
 * Get list of user's tokens
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Array<object>|null>} List of tokens or null if error
 */
async function getUserTokens(userId) {
  try {
    const { query } = require('../storage/db');
    
    const result = await query(
      'SELECT token_id, token_name, token_symbol FROM user_tokens WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error(`Error getting user tokens: ${error.message}`);
    return null;
  }
}

/**
 * Vérifier si un token existe et récupérer ses informations
 * @param {string} tokenId - ID du token à vérifier
 * @returns {Promise<object>} Informations sur le token ou erreur
 */
async function getTokenInfo(tokenId) {
  try {
    console.log(`[TOKEN_INFO] 🔍 Récupération des informations du token ${tokenId}`);
    const client = getClient();
    
    // Créer une requête d'informations sur le token
    const tokenQuery = new TokenInfoQuery()
      .setTokenId(tokenId);
    
    // Exécuter la requête
    console.log(`[TOKEN_INFO] Exécution de la requête TokenInfoQuery`);
    const tokenInfo = await tokenQuery.execute(client);
    
    console.log(`[TOKEN_INFO] ✅ Informations récupérées pour le token ${tokenId}`);
    console.log(`[TOKEN_INFO] Nom: ${tokenInfo.name}`);
    console.log(`[TOKEN_INFO] Symbole: ${tokenInfo.symbol}`);
    console.log(`[TOKEN_INFO] Compte Treasury: ${tokenInfo.treasuryAccountId.toString()}`);
    
    // Vérifier si le token a une clé d'approvisionnement (supplyKey)
    const hasSupplyKey = Boolean(tokenInfo.supplyKey);
    console.log(`[TOKEN_INFO] A une supplyKey: ${hasSupplyKey ? 'Oui' : 'Non'}`);
    
    return {
      success: true,
      tokenId: tokenId,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      treasury: tokenInfo.treasuryAccountId.toString(),
      decimals: tokenInfo.decimals,
      totalSupply: tokenInfo.totalSupply.toString(),
      supplyType: tokenInfo.supplyType,
      hasSupplyKey: hasSupplyKey  // Important pour vérifier si les airdrops sont possibles
    };
  } catch (error) {
    console.error(`[TOKEN_INFO] ❌ Erreur lors de la récupération des informations du token: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors de la récupération des informations du token: ${error.message}`
    };
  }
}

/**
 * Vérifier si un token est associé à un compte
 * @param {string} accountId - ID du compte Hedera
 * @param {string} tokenId - ID du token à vérifier
 * @returns {Promise<boolean>} True si le token est associé, false sinon
 */
async function isTokenAssociated(accountId, tokenId) {
  try {
    console.log(`[TOKEN_ASSOCIATE] 🔍 Vérification de l'association du token ${tokenId} avec le compte ${accountId}`);
    const client = getClient();
    
    // Vérifier si le compte est associé au token
    console.log(`[TOKEN_ASSOCIATE] Création de la requête AccountBalanceQuery`);
    const balanceQuery = new AccountBalanceQuery()
      .setAccountId(accountId);
    
    console.log(`[TOKEN_ASSOCIATE] Exécution de la requête de solde pour ${accountId}`);
    const accountBalance = await balanceQuery.execute(client);
    
    console.log(`[TOKEN_ASSOCIATE] Récupération des tokens pour le compte ${accountId}`);
    const tokens = accountBalance.tokens;
    
    // Vérifier si le Map contient une entrée pour ce token
    const isAssociated = tokens.get(tokenId) !== undefined;
    
    // Afficher tous les tokens associés pour le débogage
    const associatedTokens = Array.from(tokens.keys());
    console.log(`[TOKEN_ASSOCIATE] Tokens associés au compte ${accountId}: ${associatedTokens.length > 0 ? associatedTokens.join(', ') : 'Aucun'}`);
    
    if (isAssociated) {
      console.log(`[TOKEN_ASSOCIATE] ✅ Le token ${tokenId} est associé au compte ${accountId}`);
    } else {
      console.log(`[TOKEN_ASSOCIATE] ⚠️ Le token ${tokenId} n'est PAS associé au compte ${accountId}`);
      
      // Vérifier si le compte a l'option "Max Auto Associations"
      console.log(`[TOKEN_ASSOCIATE] Vérification des paramètres du compte pour déterminer si l'auto-association est possible`);
      
      // Cette partie nécessite des informations supplémentaires sur le compte
      // qui ne sont pas disponibles via la simple requête de solde
      try {
        // Récupération des infos du compte via AccountInfoQuery
        // Note: Cette fonctionnalité dépend des capacités de l'Agent Kit
        console.log(`[TOKEN_ASSOCIATE] ℹ️ Note: Le compte ${accountId} devra explicitement associer le token ${tokenId} avant de pouvoir le recevoir`);
      } catch (accountInfoError) {
        console.log(`[TOKEN_ASSOCIATE] Impossible de vérifier les paramètres avancés du compte: ${accountInfoError.message}`);
      }
    }
    
    return isAssociated;
  } catch (error) {
    console.error(`[TOKEN_ASSOCIATE] ❌ Erreur lors de la vérification de l'association du token: ${error.message}`);
    console.error(`[TOKEN_ASSOCIATE] Stack trace:`, error.stack);
    return false;
  }
}

/**
 * Associer un token à un compte
 * @param {string} userId - ID Telegram de l'utilisateur qui possède le compte
 * @param {string} tokenId - ID du token à associer
 * @returns {Promise<object>} Résultat de l'opération
 */
async function associateToken(userId, tokenId) {
  try {
    console.log(`[ASSOCIATE_TOKEN] 🔄 Début de l'association du token ${tokenId} pour l'utilisateur ${userId}`);
    const client = getClient();
    
    // Récupérer les informations du wallet
    console.log(`[ASSOCIATE_TOKEN] Récupération du wallet pour l'utilisateur ${userId}`);
    const wallet = await getWalletByUserId(userId);
    
    if (!wallet) {
      console.error(`[ASSOCIATE_TOKEN] ❌ Aucun wallet trouvé pour l'utilisateur ${userId}`);
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }
    
    console.log(`[ASSOCIATE_TOKEN] ✅ Wallet trouvé pour ${userId}: Compte ${wallet.accountId}`);
    
    // Vérifier si le token est déjà associé
    console.log(`[ASSOCIATE_TOKEN] Vérification de l'association existante du token ${tokenId}`);
    const alreadyAssociated = await isTokenAssociated(wallet.accountId, tokenId);
    
    if (alreadyAssociated) {
      console.log(`[ASSOCIATE_TOKEN] ℹ️ Le token ${tokenId} est déjà associé au compte ${wallet.accountId}`);
      return {
        success: true,
        message: `Votre compte est déjà associé au token ${tokenId}`,
        tokenId,
        accountId: wallet.accountId,
        alreadyAssociated: true
      };
    }
    
    // Création de la transaction d'association
    console.log(`[ASSOCIATE_TOKEN] Création de la transaction TokenAssociateTransaction`);
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(wallet.accountId)
      .setTokenIds([tokenId])
      .freezeWith(client);
    
    // Signer avec la clé privée du compte
    console.log(`[ASSOCIATE_TOKEN] Signature de la transaction avec la clé privée du compte ${wallet.accountId}`);
    const privateKeyObj = PrivateKey.fromString(wallet.privateKey);
    const signedTx = await transaction.sign(privateKeyObj);
    
    // Exécuter la transaction
    console.log(`[ASSOCIATE_TOKEN] Exécution de la transaction d'association`);
    const txResponse = await signedTx.execute(client);
    console.log(`[ASSOCIATE_TOKEN] Transaction soumise, attente du reçu...`);
    
    const receipt = await txResponse.getReceipt(client);
    console.log(`[ASSOCIATE_TOKEN] Reçu obtenu, statut: ${receipt.status.toString()}`);
    
    if (receipt.status.toString() !== 'SUCCESS') {
      console.error(`[ASSOCIATE_TOKEN] ❌ L'association a échoué avec le statut: ${receipt.status.toString()}`);
      return {
        success: false,
        message: `L'association du token a échoué avec le statut: ${receipt.status.toString()}`,
      };
    }
    
    const txId = txResponse.transactionId.toString();
    
    // Vérifier une fois de plus que l'association a bien été faite
    console.log(`[ASSOCIATE_TOKEN] Vérification finale de l'association du token ${tokenId}`);
    const finalCheck = await isTokenAssociated(wallet.accountId, tokenId);
    
    if (!finalCheck) {
      console.warn(`[ASSOCIATE_TOKEN] ⚠️ Malgré un statut de succès, le token ${tokenId} ne semble pas être associé au compte ${wallet.accountId}`);
    }
    
    // Préparer les URLs des explorateurs
    const hashscanUrl = `https://hashscan.io/${HEDERA_NETWORK}/tx/${txId}`;
    const hederaExplorerUrl = `https://testnet.hederaexplorer.io/tx/${txId}`;
    
    console.log(`[ASSOCIATE_TOKEN] ✅ Association réussie du token ${tokenId} au compte ${wallet.accountId}`);
    console.log(`[ASSOCIATE_TOKEN] ID de transaction: ${txId}`);
    console.log(`[ASSOCIATE_TOKEN] HashScan: ${hashscanUrl}`);
    console.log(`[ASSOCIATE_TOKEN] Hedera Explorer: ${hederaExplorerUrl}`);
    
    return {
      success: true,
      message: `Le token ${tokenId} a été associé avec succès à votre compte`,
      tokenId,
      accountId: wallet.accountId,
      transactionId: txId,
      explorerUrl: hederaExplorerUrl,
      hashscanUrl: hashscanUrl
    };
  } catch (error) {
    console.error(`[ASSOCIATE_TOKEN] ❌ Erreur lors de l'association du token:`, error);
    console.error(`[ASSOCIATE_TOKEN] Stack trace:`, error.stack);
    
    // Tenter d'identifier le type d'erreur pour un message plus précis
    let errorMessage = `Échec de l'association du token: ${error.message}`;
    
    if (error.message.includes('INSUFFICIENT_PAYER_BALANCE')) {
      errorMessage = `Solde insuffisant pour effectuer l'association du token. Veuillez recharger votre compte en HBAR.`;
    } else if (error.message.includes('TOKEN_NOT_FOUND') || error.message.includes('INVALID_TOKEN_ID')) {
      errorMessage = `Le token ${tokenId} n'existe pas ou n'est pas valide.`;
    } else if (error.message.includes('ACCOUNT_FROZEN_FOR_TOKEN')) {
      errorMessage = `L'association n'a pas pu être effectuée car votre compte est gelé pour ce token.`;
    } else if (error.message.includes('INVALID_SIGNATURE')) {
      errorMessage = `La signature de la transaction n'est pas valide. Problème avec les clés privées.`;
    }
    
    return {
      success: false,
      message: errorMessage,
    };
  }
}

/**
 * Effectuer un transfert direct de token pour la résolution d'airdrop
 * @param {string} fromUserId - ID de l'utilisateur qui envoie le token (administrateur)
 * @param {string} toAccountId - ID du compte destinataire
 * @param {string} tokenId - ID du token à transférer
 * @param {number} amount - Montant à transférer
 * @returns {Promise<object>} Résultat du transfert
 */
async function executeAirdropTransfer(fromUserId, toAccountId, tokenId, amount) {
  try {
    console.log(`[AIRDROP_TRANSFER] Démarrage du transfert direct de ${amount} tokens ${tokenId} vers ${toAccountId}`);
    
    // Récupérer les informations du compte administrateur
    const accountInfo = await getAccountInfo(fromUserId);
    if (!accountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${accountInfo.message}`
      };
    }

    const { accountId, privateKey } = accountInfo;
    console.log(`[AIRDROP_TRANSFER] ✅ Compte administrateur trouvé: ${accountId}`);
    
    // Vérifier que le token est associé au compte destinataire
    const isAssociated = await isTokenAssociated(toAccountId, tokenId);
    if (!isAssociated) {
      console.log(`[AIRDROP_TRANSFER] ⚠️ Le compte ${toAccountId} n'est pas associé au token ${tokenId}. Tentative d'association...`);
      
      // Tenter de trouver les informations du compte pour l'associer
      const userIdFromAccount = await getUserIdFromAccount(toAccountId);
      if (!userIdFromAccount) {
        return {
          success: false,
          message: `Impossible de trouver l'utilisateur associé au compte ${toAccountId} pour l'association de token`
        };
      }
      
      const associateResult = await associateToken(userIdFromAccount, tokenId);
      if (!associateResult.success) {
        return {
          success: false,
          message: `Impossible d'associer le token ${tokenId} au compte ${toAccountId}: ${associateResult.message}`
        };
      }
      
      console.log(`[AIRDROP_TRANSFER] ✅ Token ${tokenId} associé avec succès au compte ${toAccountId}`);
    } else {
      console.log(`[AIRDROP_TRANSFER] ✅ Le compte ${toAccountId} est déjà associé au token ${tokenId}`);
    }
    
    // Initialiser le client Hedera
    const client = getClient();
    
    // Créer un objet TokenId à partir de la chaîne
    const tokenIdObj = TokenId.fromString(tokenId);
    
    // Créer la transaction de transfert
    console.log(`[AIRDROP_TRANSFER] Création de la transaction de transfert`);
    const transaction = new TransferTransaction()
      .addTokenTransfer(tokenIdObj, accountId, -amount)
      .addTokenTransfer(tokenIdObj, toAccountId, amount)
      .freezeWith(client);
    
    // Signer avec la clé privée de l'administrateur
    const privateKeyObj = PrivateKey.fromString(privateKey);
    const signedTx = await transaction.sign(privateKeyObj);
    
    // Exécuter la transaction
    console.log(`[AIRDROP_TRANSFER] Exécution de la transaction de transfert`);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    if (receipt.status.toString() !== 'SUCCESS') {
      return {
        success: false,
        message: `La transaction a échoué avec le statut: ${receipt.status.toString()}`
      };
    }
    
    const txId = txResponse.transactionId.toString();
    console.log(`[AIRDROP_TRANSFER] ✅ Transfert réussi, transaction ID: ${txId}`);
    
    // Générer les URLs des explorateurs
    const explorerUrls = getExplorerUrls(txId, 'transaction');
    
    return {
      success: true,
      message: `${amount} tokens ${tokenId} ont été envoyés avec succès à ${toAccountId}`,
      transactionId: txId,
      fromAccount: accountId,
      toAccount: toAccountId,
      tokenId: tokenId,
      amount: amount,
      explorerUrl: explorerUrls.hederaExplorer,
      hashscanUrl: explorerUrls.hashScan
    };
  } catch (error) {
    console.error(`[AIRDROP_TRANSFER] ❌ Erreur lors du transfert de token: ${error.message}`);
    return {
      success: false,
      message: `Erreur lors du transfert de token: ${error.message}`
    };
  }
}

/**
 * Recherche l'ID utilisateur Telegram à partir d'un ID de compte Hedera
 * @param {string} accountId - ID du compte Hedera
 * @returns {Promise<string|null>} ID utilisateur Telegram ou null si non trouvé
 */
async function getUserIdFromAccount(accountId) {
  try {
    const { query } = require('../storage/db');
    
    const result = await query(
      'SELECT user_id FROM user_wallets WHERE account_id = $1',
      [accountId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].user_id;
    }
    
    return null;
  } catch (error) {
    console.error(`Erreur lors de la recherche de l'ID utilisateur: ${error.message}`);
    return null;
  }
}

module.exports = {
  mintToken,
  sendToken,
  storeTokenInfo,
  getTokenIdByNameOrSymbol,
  getUserTokens,
  associateToken,
  isTokenAssociated,
  executeAirdropTransfer,
  getTokenInfo
};
