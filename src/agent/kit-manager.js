/**
 * Kit Manager - Fallback implementation for Hedera Agent Kit
 * This provides a simplified interface similar to Hedera Agent Kit 
 * using our existing infrastructure
 */

const { Client, AccountId, TokenId } = require('@hashgraph/sdk');
const { getClient } = require('../hedera/client');
const { getBalance } = require('../hedera/account');
const { sendHbar } = require('../hedera/account');
const { sendToken, mintToken } = require('../hedera/tokens');
const { getTransactionHistory } = require('../hedera/transactions');

/**
 * Provides a simplified version of Hedera Agent Kit functionality
 * using our existing methods
 */
class KitManager {
  constructor(accountId, privateKey, network = 'testnet') {
    this.accountId = accountId;
    this.privateKey = privateKey;
    this.network = network;
    this.client = getClient();
  }

  /**
   * Get HBAR balance for an account
   * @param {string} accountId Optional account ID (uses operator account if not provided)
   * @returns {Promise<object>} Balance information
   */
  async getHbarBalance(accountId = this.accountId) {
    try {
      const result = await getBalance(accountId);
      
      // Si la fonction getBalance ne renvoie pas directement l'ID de compte
      // C'est probablement parce que nous avons passé un userId à la place de l'accountId
      const userId = accountId;
      
      if (!result.success) {
        return {
          success: false,
          error: result.message || "Échec de la récupération du solde"
        };
      }
      
      return {
        success: true,
        balance: result.balance.hbars, // Inclut déjà l'unité (tℏ)
        tokens: result.balance.tokens,
        accountId: result.accountId || accountId
      };
    } catch (error) {
      console.error("Erreur dans getHbarBalance:", error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transfer HBAR to another account
   * @param {string} toAccountId Recipient account ID
   * @param {string|number} amount Amount to transfer
   * @returns {Promise<object>} Transaction result
   */
  async transferHbar(toAccountId, amount) {
    try {
      const result = await sendHbar(this.accountId, toAccountId, amount);
      return {
        success: result.success,
        transactionId: result.transactionId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transfer tokens to another account
   * @param {string|TokenId} tokenId Token ID
   * @param {string} toAccountId Recipient account ID
   * @param {number} amount Amount to transfer
   * @returns {Promise<object>} Transaction result
   */
  async transferToken(tokenId, toAccountId, amount) {
    try {
      // Convert TokenId object to string if needed
      const tokenIdString = typeof tokenId === 'string' ? tokenId : tokenId.toString();
      
      const result = await sendToken(this.accountId, toAccountId, tokenIdString, amount);
      return {
        success: result.success,
        transactionId: result.transactionId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a fungible token
   * @param {object} options Token creation options
   * @returns {Promise<object>} Token creation result
   */
  async createFT(options) {
    try {
      const tokenInfo = {
        name: options.name,
        symbol: options.symbol,
        decimals: options.decimals || 0,
        initialSupply: options.initialSupply || 1000,
        supplyType: "INFINITE"
      };
      
      const result = await mintToken(this.accountId, tokenInfo);
      return {
        success: result.success,
        tokenId: result.tokenId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get transactions history for an account
   * @param {string} accountId Account ID
   * @param {string} network Network ('testnet' or 'mainnet')
   * @returns {Promise<object>} Transaction history
   */
  async getTransactionHistory(accountId = this.accountId, network = this.network) {
    try {
      const result = await getTransactionHistory(accountId);
      return {
        success: result.success,
        transactions: result.transactions
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export as both default (ESM style) and module.exports (CommonJS style)
module.exports = KitManager;
module.exports.createHederaTools = function(options) {
  return [
    {
      name: 'getHbarBalance',
      description: 'Get HBAR balance for an account',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The account ID to check balance for'
          }
        }
      },
      execute: async ({ accountId }) => {
        const { getBalance } = require('../hedera/account');
        return await getBalance(accountId);
      }
    },
    {
      name: 'transferHbar',
      description: 'Transfer HBAR to another account',
      parameters: {
        type: 'object',
        properties: {
          toAccountId: {
            type: 'string',
            description: 'The recipient account ID'
          },
          amount: {
            type: 'string',
            description: 'The amount of HBAR to transfer'
          }
        },
        required: ['toAccountId', 'amount']
      },
      execute: async ({ toAccountId, amount, userId }) => {
        const { sendHbar } = require('../hedera/account');
        return await sendHbar(userId, toAccountId, amount);
      }
    },
    {
      name: 'transferToken',
      description: 'Transfer tokens to another account',
      parameters: {
        type: 'object',
        properties: {
          tokenId: {
            type: 'string',
            description: 'The token ID to transfer'
          },
          toAccountId: {
            type: 'string',
            description: 'The recipient account ID'
          },
          amount: {
            type: 'number',
            description: 'The amount of tokens to transfer'
          }
        },
        required: ['tokenId', 'toAccountId', 'amount']
      },
      execute: async ({ tokenId, toAccountId, amount, userId }) => {
        const { sendToken } = require('../hedera/tokens');
        return await sendToken(userId, toAccountId, tokenId, amount);
      }
    },
    {
      name: 'createFT',
      description: 'Create a new fungible token',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The token name'
          },
          symbol: {
            type: 'string',
            description: 'The token symbol'
          },
          initialSupply: {
            type: 'number',
            description: 'The initial supply of tokens'
          }
        },
        required: ['name', 'symbol']
      },
      execute: async ({ name, symbol, initialSupply, userId }) => {
        const { mintToken } = require('../hedera/tokens');
        
        const tokenInfo = {
          name: name,
          symbol: symbol,
          decimals: 0,
          initialSupply: initialSupply || 1000,
          supplyType: "INFINITE"
        };
        
        return await mintToken(userId, tokenInfo);
      }
    }
  ];
};