/**
 * Hedera Token Service (HTS) operations
 * Create and manage tokens
 */

const {
  TokenCreateTransaction,
  TokenType,
  TransferTransaction,
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
    const {
      name = `Token-${Date.now()}`,
      symbol = `TKN${Math.floor(Math.random() * 1000)}`,
      decimals = 0,
      initialSupply = 1000,
    } = tokenInfo || {};

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

    return {
      success: true,
      message: `Token created successfully: ${name} (${symbol})`,
      tokenId,
      tokenName: name,
      tokenSymbol: symbol,
      initialSupply,
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

module.exports = {
  mintToken,
  sendToken,
};
