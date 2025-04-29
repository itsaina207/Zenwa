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
 * Récupère les informations du compte d'un utilisateur
 * @param {string} userId - ID Telegram de l'utilisateur
 * @returns {Promise<Object>} Informations du compte ou objet d'erreur
 */
async function getAccountInfo(userId) {
  try {
    const wallet = await getWalletByUserId(userId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet'
      };
    }
    
    return {
      success: true,
      accountId: wallet.accountId,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      evmAddress: wallet.evm_address
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des informations du compte: ${error.message}`);
    return {
      success: false,
      message: `Erreur: ${error.message}`
    };
  }
}

/**
 * Create a new Hedera account for a user
 * @param {string} userId - Telegram user ID
 * @param {string} [username] - Telegram username (optional)
 * @param {string} [phoneNumber] - User's phone number (optional)
 * @returns {Promise<object>} Account information
 */
async function createAccount(userId, username, phoneNumber) {
  try {
    const client = getClient();
    
    // Check if user already has an account
    const existingWallet = await getWalletByUserId(userId);
    if (existingWallet) {
      // Si un numéro de téléphone est fourni et que le portefeuille n'en a pas, mettre à jour
      if (phoneNumber && !existingWallet.phoneNumber) {
        const { query } = require('../storage/db');
        await query(
          'UPDATE user_wallets SET phone_number = $1 WHERE user_id = $2',
          [phoneNumber, userId]
        );
        console.log(`Numéro de téléphone ${phoneNumber} ajouté au wallet de l'utilisateur ${userId}`);
      }
      
      return {
        success: true,
        message: 'Vous avez déjà un wallet',
        accountId: existingWallet.accountId,
        evmAddress: existingWallet.evmAddress,
        privateKey: existingWallet.privateKey,
        publicKey: existingWallet.publicKey,
        username: existingWallet.username || username,
        phoneNumber: phoneNumber || existingWallet.phoneNumber,
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
      username: username || null, // Store the username if provided
      phoneNumber: phoneNumber || null, // Store the phone number if provided
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
 * @param {string} userIdOrAccountId - Telegram user ID or Hedera account ID
 * @returns {Promise<object>} Balance information
 */
async function getBalance(userIdOrAccountId) {
  try {
    const client = getClient();
    let accountId;
    
    // Déterminer si l'entrée est un ID de compte Hedera (0.0.xxxx) ou un ID utilisateur
    if (userIdOrAccountId.match(/^\d+\.\d+\.\d+$/)) {
      // C'est un ID de compte Hedera, utiliser directement
      accountId = userIdOrAccountId;
    } else {
      // C'est un ID utilisateur, récupérer le wallet
      const wallet = await getWalletByUserId(userIdOrAccountId);
      
      if (!wallet) {
        return {
          success: false,
          message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
        };
      }
      
      accountId = wallet.accountId;
    }

    // Query the account balance
    const query = new AccountBalanceQuery()
      .setAccountId(accountId);

    const accountBalance = await query.execute(client);

    // Extraction améliorée des tokens avec debug
    console.log(`[BALANCE] Récupération des tokens pour le compte ${accountId}`);
    
    // Créer un objet pour stocker les informations des tokens
    const tokenBalances = {};
    
    // Parcourir tous les tokens associés au compte
    if (accountBalance.tokens) {
      try {
        // Analyser et logger la structure de l'objet des tokens
        console.log(`[BALANCE] Structure des tokens: ${JSON.stringify(accountBalance.tokens)}`);
        
        // Vérifier si c'est un Map ou un objet standard
        if (accountBalance.tokens._map) {
          console.log(`[BALANCE] Tokens trouvés via _map: ${accountBalance.tokens._map.size}`);
          // C'est un Map
          accountBalance.tokens._map.forEach((value, key) => {
            console.log(`[BALANCE] Token trouvé: ${key.toString()} = ${value.toString()}`);
            tokenBalances[key.toString()] = value.toString();
          });
        } else if (accountBalance.tokens.size) {
          console.log(`[BALANCE] Tokens trouvés via size: ${accountBalance.tokens.size}`);
          // C'est un Map standard
          accountBalance.tokens.forEach((value, key) => {
            tokenBalances[key.toString()] = value.toString();
          });
        } else {
          // C'est peut-être un objet avec une autre structure
          console.log(`[BALANCE] Tentative d'extraction alternative des tokens`);
          Object.entries(accountBalance.tokens).forEach(([key, value]) => {
            if (key !== '_map' && key !== 'size') {
              tokenBalances[key] = value.toString();
            }
          });
        }
      } catch (err) {
        console.error(`[BALANCE] Erreur lors de l'extraction des tokens: ${err.message}`);
      }
    }
    
    console.log(`[BALANCE] Tokens extraits: ${JSON.stringify(tokenBalances)}`);
    
    return {
      success: true,
      balance: {
        hbars: accountBalance.hbars.toString(),
        tokens: Object.keys(tokenBalances).length > 0 
               ? tokenBalances 
               : 'Aucun token',
      },
      accountId: accountId,
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
 * @param {string} toAccountId - Recipient's Hedera account ID or phone number
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

    // Résoudre l'identifiant du destinataire (téléphone ou compte Hedera)
    const { resolveToAccountId } = require('../utils/identifiers');
    const resolvedAccountId = await resolveToAccountId(toAccountId);
    
    if (!resolvedAccountId) {
      return {
        success: false,
        message: 'Impossible de résoudre l\'identifiant du destinataire. Vérifiez que le numéro de téléphone ou l\'adresse Hedera est correcte.',
      };
    }
    
    // Utiliser l'identifiant résolu
    const receiverAccountId = resolvedAccountId;

    // Validate destination account format
    try {
      AccountId.fromString(receiverAccountId);
    } catch (e) {
      return {
        success: false,
        message: 'ID de compte destinataire invalide après résolution. Format correct: 0.0.xxxxx',
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
  getAccountInfo,
};
