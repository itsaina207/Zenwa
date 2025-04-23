/**
 * Transaction history operations using Hedera Mirror Node API
 */

const axios = require('axios');
const { MIRROR_NODE_URL, HEDERA_NETWORK } = require('../config');
const { getWalletByUserId } = require('../storage/userWallets');

/**
 * Get transaction history for a user's account
 * @param {string} userId - Telegram user ID
 * @param {number} limit - Maximum number of transactions to return
 * @returns {Promise<object>} Transaction history
 */
async function getTransactionHistory(userId, limit = 10) {
  try {
    const wallet = await getWalletByUserId(userId);
    
    if (!wallet) {
      return {
        success: false,
        message: 'Aucun wallet trouvé. Créez-en un d\'abord avec /createwallet',
      };
    }

    // Query the mirror node API for transactions
    const response = await axios.get(`${MIRROR_NODE_URL}/transactions`, {
      params: {
        'account.id': wallet.accountId,
        limit,
        order: 'desc',
      },
    });

    if (!response.data || !response.data.transactions) {
      return {
        success: true,
        message: 'Aucune transaction trouvée',
        transactions: [],
        accountId: wallet.accountId,
      };
    }

    // Format the transactions for display
    const transactions = response.data.transactions.map(tx => ({
      id: tx.transaction_id,
      timestamp: new Date(tx.consensus_timestamp * 1000).toISOString(),
      type: tx.name || 'TRANSACTION',
      result: tx.result,
      fee: tx.charged_tx_fee / 100000000, // Convert tinybar to HBAR
      explorerUrl: `https://hashscan.io/${HEDERA_NETWORK}/tx/${tx.transaction_id}`,
    }));

    return {
      success: true,
      accountId: wallet.accountId,
      transactions,
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'historique des transactions: ${error.message}`);
    return {
      success: false,
      message: `Échec de la récupération de l'historique des transactions: ${error.message}`,
    };
  }
}

module.exports = {
  getTransactionHistory,
};
