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
 * Vérifier si un token est associé à un compte
 * @param {string} accountId - ID du compte Hedera
 * @param {string} tokenId - ID du token à vérifier
 * @returns {Promise<boolean>} True si le token est associé, false sinon
 */
async function isTokenAssociated(accountId, tokenId) {
  try {
    const client = getClient();
    
    // Vérifier si le compte est associé au token
    const balanceQuery = new AccountBalanceQuery()
      .setAccountId(accountId);
    
    const accountBalance = await balanceQuery.execute(client);
    const tokens = accountBalance.tokens;
    const isAssociated = tokens.get(tokenId) !== undefined;
    
    return isAssociated;
  } catch (error) {
    console.error(`Erreur lors de la vérification de l'association du token: ${error.message}`);
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
    const client = getClient();
    const wallet = await getWalletByUserId(userId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }
    
    // Vérifier si le token est déjà associé
    const alreadyAssociated = await isTokenAssociated(wallet.accountId, tokenId);
    if (alreadyAssociated) {
      return {
        success: true,
        message: `Votre compte est déjà associé au token ${tokenId}`,
        tokenId,
        accountId: wallet.accountId,
        alreadyAssociated: true
      };
    }
    
    // Création de la transaction d'association
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(wallet.accountId)
      .setTokenIds([tokenId])
      .freezeWith(client);
    
    // Signer avec la clé privée du compte
    const signedTx = await transaction.sign(
      PrivateKey.fromString(wallet.privateKey)
    );
    
    // Exécuter la transaction
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    if (receipt.status.toString() !== 'SUCCESS') {
      return {
        success: false,
        message: `L'association du token a échoué avec le statut: ${receipt.status.toString()}`,
      };
    }
    
    const txId = txResponse.transactionId.toString();
    
    return {
      success: true,
      message: `Le token ${tokenId} a été associé avec succès à votre compte`,
      tokenId,
      accountId: wallet.accountId,
      transactionId: txId,
      explorerUrl: `https://hashscan.io/${HEDERA_NETWORK}/tx/${txId}`,
    };
  } catch (error) {
    console.error(`Erreur lors de l'association du token: ${error.message}`);
    return {
      success: false,
      message: `Échec de l'association du token: ${error.message}`,
    };
  }
}

module.exports = {
  mintToken,
  sendToken,
  storeTokenInfo,
  getTokenIdByNameOrSymbol,
  getUserTokens,
  associateToken,
  isTokenAssociated
};
