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
  
  /**
   * Create a topic on the Hedera Consensus Service (HCS)
   * @param {string} topicMemo Description for the topic
   * @param {boolean} isSubmitKey Whether to require a submit key to post messages
   * @returns {Promise<object>} Created topic information
   */
  async createTopic(topicMemo, isSubmitKey = false) {
    try {
      // Import necessary modules
      const { 
        TopicCreateTransaction, 
        PrivateKey, 
        TopicId 
      } = require('@hashgraph/sdk');
      
      // Create a new topic
      let transaction = new TopicCreateTransaction()
        .setTopicMemo(topicMemo)
        .setSubmitKey(isSubmitKey ? PrivateKey.generateED25519().publicKey : null)
        .setAdminKey(PrivateKey.fromString(this.privateKey).publicKey);
      
      // Submit the transaction
      const txResponse = await transaction.execute(this.client);
      
      // Get the receipt
      const receipt = await txResponse.getReceipt(this.client);
      
      // Get the topic ID
      const topicId = receipt.topicId;
      
      return {
        topicId: topicId,
        memo: topicMemo,
        txHash: txResponse.transactionId.toString(),
        isSubmitKey: isSubmitKey
      };
    } catch (error) {
      console.error("Erreur dans createTopic:", error.message);
      throw error;
    }
  }
  
  /**
   * Submit a message to a Hedera Consensus Service (HCS) topic
   * @param {TopicId|string} topicId Topic ID to submit message to
   * @param {string} message Message content 
   * @returns {Promise<object>} Result of the message submission
   */
  async submitTopicMessage(topicId, message) {
    try {
      // Import necessary modules
      const { 
        TopicMessageSubmitTransaction, 
        TopicId
      } = require('@hashgraph/sdk');
      
      // Convert topicId to TopicId object if it's a string
      const topicIdObj = typeof topicId === 'string' 
        ? TopicId.fromString(topicId) 
        : topicId;
      
      // Create the transaction
      const transaction = new TopicMessageSubmitTransaction({
        topicId: topicIdObj,
        message: message
      });
      
      // Submit the transaction
      const txResponse = await transaction.execute(this.client);
      
      // Get the receipt
      const receipt = await txResponse.getReceipt(this.client);
      
      return {
        topicId: topicIdObj.toString(),
        message: message,
        txHash: txResponse.transactionId.toString(),
        status: receipt.status.toString()
      };
    } catch (error) {
      console.error("Erreur dans submitTopicMessage:", error.message);
      throw error;
    }
  }
  
  /**
   * Get messages from a topic
   * @param {string} topicId - The topic ID
   * @param {string} network - 'mainnet', 'testnet', or 'previewnet'
   * @returns {Promise<Array>} Messages from the topic
   */
  async getTopicMessages(topicId, network = this.network) {
    try {
      const axios = require('axios');
      
      // Determine the mirror node URL based on network
      let mirrorNodeUrl;
      switch (network.toLowerCase()) {
        case 'mainnet':
          mirrorNodeUrl = 'https://mainnet-public.mirrornode.hedera.com';
          break;
        case 'testnet':
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
          break;
        default:
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
      }
      
      // Fetch messages from the mirror node
      const response = await axios.get(
        `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages`
      );
      
      // Process and return the messages
      if (response.data && response.data.messages) {
        return response.data.messages.map(msg => {
          const decodedMessage = Buffer.from(msg.message, 'base64').toString('utf8');
          return {
            sequenceNumber: msg.sequence_number,
            consensusTimestamp: msg.consensus_timestamp,
            message: decodedMessage,
            topicId: topicId
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error("Erreur dans getTopicMessages:", error.message);
      return [];
    }
  }
  
  /**
   * Get information about a topic
   * @param {string} topicId - The topic ID
   * @param {string} network - 'mainnet', 'testnet', or 'previewnet'
   * @returns {Promise<object>} Information about the topic
   */
  async getTopicInfo(topicId, network = this.network) {
    try {
      const axios = require('axios');
      
      // Determine the mirror node URL based on network
      let mirrorNodeUrl;
      switch (network.toLowerCase()) {
        case 'mainnet':
          mirrorNodeUrl = 'https://mainnet-public.mirrornode.hedera.com';
          break;
        case 'testnet':
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
          break;
        default:
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
      }
      
      // Fetch topic info from the mirror node
      const response = await axios.get(
        `${mirrorNodeUrl}/api/v1/topics/${topicId}`
      );
      
      if (response.data) {
        return {
          topicId: response.data.topic_id,
          memo: response.data.memo,
          adminKey: response.data.admin_key,
          submitKey: response.data.submit_key,
          createdTimestamp: response.data.created_timestamp,
          expirationTime: response.data.expiration_timestamp,
          autoRenewAccount: response.data.auto_renew_account,
          autoRenewPeriod: response.data.auto_renew_period
        };
      }
      
      throw new Error(`Topic ${topicId} not found`);
    } catch (error) {
      console.error("Erreur dans getTopicInfo:", error.message);
      throw error;
    }
  }
  
  /**
   * Get token details
   * @param {string} tokenId - The token ID
   * @param {string} network - 'mainnet', 'testnet', or 'previewnet'
   * @returns {Promise<object>} Token details
   */
  async getHtsTokenDetails(tokenId, network = this.network) {
    try {
      const axios = require('axios');
      
      // Determine the mirror node URL based on network
      let mirrorNodeUrl;
      switch (network.toLowerCase()) {
        case 'mainnet':
          mirrorNodeUrl = 'https://mainnet-public.mirrornode.hedera.com';
          break;
        case 'testnet':
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
          break;
        default:
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
      }
      
      // Fetch token info from the mirror node
      const response = await axios.get(
        `${mirrorNodeUrl}/api/v1/tokens/${tokenId}`
      );
      
      if (response.data) {
        return {
          tokenId: response.data.token_id,
          name: response.data.name,
          symbol: response.data.symbol,
          decimals: response.data.decimals,
          totalSupply: response.data.total_supply,
          treasury: response.data.treasury_account_id,
          adminKey: response.data.admin_key,
          supplyKey: response.data.supply_key,
          freezeKey: response.data.freeze_key,
          wipeKey: response.data.wipe_key,
          kycKey: response.data.kyc_key,
          pauseKey: response.data.pause_key,
          customFees: response.data.custom_fees
        };
      }
      
      throw new Error(`Token ${tokenId} not found`);
    } catch (error) {
      console.error("Erreur dans getHtsTokenDetails:", error.message);
      throw error;
    }
  }
  
  /**
   * Get token holders
   * @param {string} tokenId - The token ID
   * @param {string} network - 'mainnet', 'testnet', or 'previewnet'
   * @param {number} threshold - Minimum balance to be considered a holder
   * @returns {Promise<Array>} Token holders
   */
  async getTokenHolders(tokenId, network = this.network, threshold = 1) {
    try {
      const axios = require('axios');
      
      // Determine the mirror node URL based on network
      let mirrorNodeUrl;
      switch (network.toLowerCase()) {
        case 'mainnet':
          mirrorNodeUrl = 'https://mainnet-public.mirrornode.hedera.com';
          break;
        case 'testnet':
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
          break;
        default:
          mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
      }
      
      // Fetch token holders from the mirror node
      const response = await axios.get(
        `${mirrorNodeUrl}/api/v1/tokens/${tokenId}/balances?limit=100`
      );
      
      if (response.data && response.data.balances) {
        return response.data.balances
          .filter(balance => parseInt(balance.balance) >= threshold)
          .map(balance => ({
            accountId: balance.account,
            balance: balance.balance,
            timestamp: balance.timestamp
          }));
      }
      
      return [];
    } catch (error) {
      console.error("Erreur dans getTokenHolders:", error.message);
      return [];
    }
  }
}

// Export as both default (ESM style) and module.exports (CommonJS style)
module.exports = KitManager;
module.exports.createHederaTools = function(options) {
  return [
    {
      name: 'getHbarBalance',
      description: 'Get HBAR balance for a Hedera account',
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
      description: 'Transfer HBAR from one account to another',
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
      description: 'Transfer tokens from one account to another',
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
      description: 'Create a new fungible token (HTS)',
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
    },
    {
      name: 'createTopic',
      description: 'Create a new Hedera Consensus Service (HCS) topic for messaging or consensus',
      parameters: {
        type: 'object',
        properties: {
          topicMemo: {
            type: 'string',
            description: 'Description or purpose of the topic'
          },
          isSubmitKey: {
            type: 'boolean',
            description: 'Whether to require a submit key to post messages'
          }
        },
        required: ['topicMemo']
      },
      execute: async ({ topicMemo, isSubmitKey, userId }) => {
        const kitManager = new KitManager();
        return await kitManager.createTopic(topicMemo, isSubmitKey);
      }
    },
    {
      name: 'submitTopicMessage',
      description: 'Submit a message to a Hedera Consensus Service (HCS) topic',
      parameters: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            description: 'The topic ID to submit message to'
          },
          message: {
            type: 'string',
            description: 'Message content to submit to the topic'
          }
        },
        required: ['topicId', 'message']
      },
      execute: async ({ topicId, message, userId }) => {
        const kitManager = new KitManager();
        return await kitManager.submitTopicMessage(topicId, message);
      }
    },
    {
      name: 'getTopicMessages',
      description: 'Get messages from a Hedera Consensus Service (HCS) topic',
      parameters: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            description: 'The topic ID to get messages from'
          }
        },
        required: ['topicId']
      },
      execute: async ({ topicId }) => {
        const kitManager = new KitManager();
        return await kitManager.getTopicMessages(topicId);
      }
    },
    {
      name: 'getTokenDetails',
      description: 'Get detailed information about a token (HTS)',
      parameters: {
        type: 'object',
        properties: {
          tokenId: {
            type: 'string',
            description: 'The token ID to get details for'
          }
        },
        required: ['tokenId']
      },
      execute: async ({ tokenId }) => {
        const kitManager = new KitManager();
        return await kitManager.getHtsTokenDetails(tokenId);
      }
    }
  ];
};