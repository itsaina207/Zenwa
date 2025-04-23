/**
 * Hedera account operations
 * Manage accounts and check balances
 */

const {
  AccountId,
  PrivateKey,
  AccountCreateTransaction,
  AccountBalanceQuery,
  Hbar,
  TransferTransaction,
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getWalletByUserId, storeWallet } = require('../storage/userWallets');
const { HEDERA_NETWORK } = require('../config');

/**
 * Create a new Hedera account for a user
 * @param {string} userId - Telegram user ID
 * @returns {Promise<object>} Account information
 */
async function createAccount(userId) {
  try {
    const client = getClient();
    
    // Check if user already has an account
    const existingWallet = await getWalletByUserId(userId);
    if (existingWallet) {
      return {
        success: true,
        message: 'Vous avez déjà un wallet',
        accountId: existingWallet.accountId,
        evmAddress: existingWallet.evmAddress,
        privateKey: existingWallet.privateKey,
        publicKey: existingWallet.publicKey,
      };
    }

    // Generate new key pair for the account
    const accountPrivateKey = PrivateKey.generateECDSA();
    const accountPublicKey = accountPrivateKey.publicKey;

    // Create a new account with initial balance of 0 HBAR
    // Also set the EVM address alias using the public key
    const txCreateAccount = new AccountCreateTransaction()
      .setAlias(accountPublicKey.toEvmAddress())
      .setKey(accountPublicKey)
      .setInitialBalance(Hbar.from(0));
    
    // Submit the transaction to the Hedera network
    const txCreateAccountResponse = await txCreateAccount.execute(client);

    // Get the receipt to confirm success and get the new account ID
    const receiptCreateAccountTx = await txCreateAccountResponse.getReceipt(client);
    
    // Get the new account ID
    const accountId = receiptCreateAccountTx.accountId.toString();
    
    // Get the transaction ID for the explorer URL
    const txIdAccountCreated = txCreateAccountResponse.transactionId.toString();
    
    // Get the EVM address for this account
    const evmAddress = accountPublicKey.toEvmAddress();

    // Store wallet information
    const wallet = {
      userId,
      accountId,
      privateKey: accountPrivateKey.toString(),
      publicKey: accountPublicKey.toString(),
      evmAddress,
      created: new Date().toISOString(),
    };
    
    // Store wallet in database (async)
    const storeResult = await storeWallet(wallet);
    if (!storeResult) {
      console.error(`Failed to store wallet for user ${userId}`);
    }

    return {
      success: true,
      message: 'Wallet créé avec succès',
      accountId,
      evmAddress,
      privateKey: accountPrivateKey.toString(),
      publicKey: accountPublicKey.toString(),
      transactionId: txIdAccountCreated,
      explorerUrl: `https://hashscan.io/${HEDERA_NETWORK}/tx/${txIdAccountCreated}`,
    };
  } catch (error) {
    console.error(`Error creating account: ${error.message}`);
    return {
      success: false,
      message: `Échec de la création du wallet: ${error.message}`,
    };
  }
}

/**
 * Get account balance for a user's Hedera account
 * @param {string} userId - Telegram user ID
 * @returns {Promise<object>} Balance information
 */
async function getBalance(userId) {
  try {
    const client = getClient();
    const wallet = await getWalletByUserId(userId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }

    // Query the account balance
    const query = new AccountBalanceQuery()
      .setAccountId(wallet.accountId);

    const accountBalance = await query.execute(client);

    return {
      success: true,
      balance: {
        hbars: accountBalance.hbars.toString(),
        tokens: accountBalance.tokens._map.size > 0 
               ? Object.fromEntries(accountBalance.tokens._map) 
               : 'Aucun token',
      },
      accountId: wallet.accountId,
    };
  } catch (error) {
    console.error(`Error getting balance: ${error.message}`);
    return {
      success: false,
      message: `Échec de la récupération du solde: ${error.message}`,
    };
  }
}

/**
 * Send HBAR from one user to a destination account
 * @param {string} fromUserId - Sender's Telegram user ID
 * @param {string} toAccountId - Recipient's Hedera account ID
 * @param {number|string} amount - Amount of HBAR to send
 * @returns {Promise<object>} Transaction result
 */
async function sendHbar(fromUserId, toAccountId, amount) {
  try {
    const client = getClient();
    const wallet = await getWalletByUserId(fromUserId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }

    // Validate destination account
    try {
      AccountId.fromString(toAccountId);
    } catch (e) {
      return {
        success: false,
        message: 'ID de compte destinataire invalide. Format correct: 0.0.xxxxx',
      };
    }

    // Convert amount to number first
    const amountFloat = parseFloat(amount);
    
    // Check if amount is valid
    if (amountFloat <= 0 || isNaN(amountFloat)) {
      return {
        success: false,
        message: 'Le montant doit être un nombre supérieur à 0',
      };
    }
    
    // Create Hbar instance with the validated amount
    const hbarAmount = new Hbar(amountFloat);
    
    // Check user's balance before attempting to send
    const balanceResult = await getBalance(fromUserId);
    if (!balanceResult.success) {
      return {
        success: false,
        message: 'Impossible de vérifier votre solde. Veuillez réessayer.',
      };
    }
    
    // Parse both the current balance and requested amount as numbers for comparison
    const balanceStr = balanceResult.balance.hbars;
    const currentBalanceValue = parseFloat(balanceStr);
    const requestedAmount = parseFloat(amount);
    
    if (requestedAmount > currentBalanceValue) {
      return {
        success: false,
        message: `Solde insuffisant. Vous avez ${balanceStr} mais vous essayez d'envoyer ${amount} HBAR.`,
      };
    }

    // Create the transfer transaction
    const transaction = new TransferTransaction()
      .addHbarTransfer(wallet.accountId, hbarAmount.negated())
      .addHbarTransfer(toAccountId, hbarAmount)
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
        message: `La transaction a échoué avec le statut: ${receipt.status.toString()}`,
      };
    }

    const txId = txResponse.transactionId.toString();

    return {
      success: true,
      message: `${amount} HBAR ont été envoyés avec succès à ${toAccountId}`,
      amount: hbarAmount.toString(),
      fromAccount: wallet.accountId,
      toAccount: toAccountId,
      transactionId: txId,
      explorerUrl: `https://hashscan.io/${HEDERA_NETWORK}/tx/${txId}`,
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de HBAR: ${error.message}`);
    return {
      success: false,
      message: `Échec de l'envoi de HBAR: ${error.message}`,
    };
  }
}

module.exports = {
  createAccount,
  getBalance,
  sendHbar,
};
