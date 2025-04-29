/**
 * Eliza Plugin for Hedera integration
 * Allows natural language queries about blockchain state
 */

const { Client, AccountBalanceQuery } = require('@hashgraph/sdk');
const axios = require('axios');
const { getMirrorNodeClient } = require('../hedera/mirror-node');
const { getClient } = require('../hedera/client');
const userWallets = require('../storage/userWallets');
const airdrops = require('../storage/airdrops');
const tokens = require('../hedera/tokens');

// Mirror node client for blockchain queries
const mirrorNodeClient = getMirrorNodeClient();

/**
 * Eliza Plugin Handler for Hedera queries
 * Processes natural language queries about blockchain state
 */
class ElizaHederaPlugin {
  constructor() {
    this.client = getClient();
  }

  /**
   * Process a natural language query about Hedera
   * @param {string} userId - The user's Telegram ID
   * @param {string} query - The natural language query
   * @returns {Promise<object>} The response object
   */
  async processQuery(userId, query) {
    // Normalize the query for better matching
    const normalizedQuery = query.toLowerCase().trim();
    
    try {
      // Check if query is about airdrop eligibility
      if (
        normalizedQuery.includes('eligible') && 
        normalizedQuery.includes('airdrop')
      ) {
        return await this.checkAirdropEligibility(userId);
      }
      
      // Check if query is about token ownership
      if (
        (normalizedQuery.includes('who') || normalizedQuery.includes('list')) && 
        normalizedQuery.includes('owns') && 
        normalizedQuery.includes('token')
      ) {
        // Extract token ID from query
        const tokenIdMatch = normalizedQuery.match(/0\.0\.\d+/);
        if (tokenIdMatch) {
          return await this.getTokenOwners(tokenIdMatch[0]);
        } else {
          return {
            success: false,
            message: "Please specify a token ID in format 0.0.XXXXX"
          };
        }
      }
      
      // Check if query is about user's token balance
      if (
        normalizedQuery.includes('my') && 
        normalizedQuery.includes('token') && 
        normalizedQuery.includes('balance')
      ) {
        return await this.getUserTokenBalances(userId);
      }
      
      // Check if query is about token info
      if (
        normalizedQuery.includes('token') && 
        normalizedQuery.includes('info')
      ) {
        // Extract token ID from query
        const tokenIdMatch = normalizedQuery.match(/0\.0\.\d+/);
        if (tokenIdMatch) {
          return await this.getTokenInfo(tokenIdMatch[0]);
        } else {
          return {
            success: false,
            message: "Please specify a token ID in format 0.0.XXXXX"
          };
        }
      }
      
      // Default response for unrecognized queries
      return {
        success: false,
        message: "I couldn't understand your query. Try asking about airdrop eligibility, token ownership, token balances, or token information."
      };
    } catch (error) {
      console.error('Error in Eliza plugin:', error);
      return {
        success: false,
        message: `Error processing your query: ${error.message}`
      };
    }
  }

  /**
   * Check if a user is eligible for any airdrops
   * @param {string} userId - The user's Telegram ID
   * @returns {Promise<object>} Eligibility information
   */
  async checkAirdropEligibility(userId) {
    try {
      // Get user's wallet
      const wallet = await userWallets.getWalletByUserId(userId);
      if (!wallet) {
        return {
          success: false,
          message: "You don't have a wallet yet. Create one first with /createwallet"
        };
      }

      // Get available airdrops
      const availableAirdrops = await airdrops.getAvailableAirdrops(userId);
      
      if (availableAirdrops.length === 0) {
        return {
          success: true,
          message: "You are not eligible for any airdrops at the moment."
        };
      }
      
      // Format airdrop information
      const airdropList = availableAirdrops.map(airdrop => 
        `Token: ${airdrop.tokenId}, Amount: ${airdrop.amount}`
      ).join('\n');
      
      return {
        success: true,
        message: `You are eligible for the following airdrops:\n${airdropList}\n\nUse /claimairdrop to claim them.`
      };
    } catch (error) {
      console.error('Error checking airdrop eligibility:', error);
      return {
        success: false,
        message: `Error checking airdrop eligibility: ${error.message}`
      };
    }
  }

  /**
   * Get the list of accounts that own a specific token
   * @param {string} tokenId - The token ID
   * @returns {Promise<object>} List of token owners
   */
  async getTokenOwners(tokenId) {
    try {
      // Validate token ID format
      if (!tokenId.match(/^0\.0\.\d+$/)) {
        return {
          success: false,
          message: "Invalid token ID format. Please use format 0.0.XXXXX"
        };
      }
      
      // Query the mirror node for token holders
      const response = await mirrorNodeClient.get(`/tokens/${tokenId}/balances`);
      
      if (!response.data || !response.data.balances) {
        return {
          success: false,
          message: "Could not retrieve token holders information."
        };
      }
      
      const balances = response.data.balances;
      
      if (balances.length === 0) {
        return {
          success: true,
          message: `No accounts currently hold token ${tokenId}.`
        };
      }
      
      // Format the token holders information
      const holdersList = balances
        .slice(0, 10) // Limit to first 10 holders
        .map(holder => `Account: ${holder.account}, Balance: ${holder.balance}`)
        .join('\n');
        
      const totalHolders = balances.length;
      const hasMore = totalHolders > 10;
      
      return {
        success: true,
        message: `Token ${tokenId} holders (${hasMore ? 'first 10 of ' + totalHolders : totalHolders}):\n${holdersList}`
      };
    } catch (error) {
      console.error('Error getting token owners:', error);
      return {
        success: false,
        message: `Error retrieving token owners: ${error.message}`
      };
    }
  }

  /**
   * Get all token balances for a user
   * @param {string} userId - The user's Telegram ID
   * @returns {Promise<object>} Token balance information
   */
  async getUserTokenBalances(userId) {
    try {
      // Get user's wallet
      const wallet = await userWallets.getWalletByUserId(userId);
      if (!wallet) {
        return {
          success: false,
          message: "You don't have a wallet yet. Create one first with /createwallet"
        };
      }

      // Query account balance
      const accountId = wallet.account_id;
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(accountId);
      
      const accountBalance = await balanceQuery.execute(this.client);
      
      // Format token balances
      const tokenBalances = accountBalance.tokens;
      
      if (tokenBalances.size === 0) {
        return {
          success: true,
          message: `You don't own any tokens yet. Your HBAR balance is ${accountBalance.hbars.toString()}.`
        };
      }
      
      const balancesList = Array.from(tokenBalances.entries())
        .map(([tokenId, balance]) => `Token: ${tokenId}, Balance: ${balance}`)
        .join('\n');
      
      return {
        success: true,
        message: `Your HBAR balance: ${accountBalance.hbars.toString()}\n\nYour token balances:\n${balancesList}`
      };
    } catch (error) {
      console.error('Error getting user token balances:', error);
      return {
        success: false,
        message: `Error retrieving your token balances: ${error.message}`
      };
    }
  }

  /**
   * Get detailed information about a token
   * @param {string} tokenId - The token ID
   * @returns {Promise<object>} Token information
   */
  async getTokenInfo(tokenId) {
    try {
      // Validate token ID format
      if (!tokenId.match(/^0\.0\.\d+$/)) {
        return {
          success: false,
          message: "Invalid token ID format. Please use format 0.0.XXXXX"
        };
      }
      
      // Query the mirror node for token info
      const response = await mirrorNodeClient.get(`/tokens/${tokenId}`);
      
      if (!response.data) {
        return {
          success: false,
          message: "Could not retrieve token information."
        };
      }
      
      const tokenInfo = response.data;
      
      // Format token information
      const formattedInfo = `
Token ID: ${tokenId}
Name: ${tokenInfo.name || 'Not specified'}
Symbol: ${tokenInfo.symbol || 'Not specified'}
Type: ${tokenInfo.type || 'Not specified'}
Total Supply: ${tokenInfo.total_supply || 'Not specified'}
Treasury Account: ${tokenInfo.treasury_account_id || 'Not specified'}
Created: ${new Date(tokenInfo.created_timestamp).toLocaleString() || 'Not specified'}
Modified: ${new Date(tokenInfo.modified_timestamp).toLocaleString() || 'Not specified'}
Custom Fees: ${tokenInfo.custom_fees?.created_timestamp ? 'Yes' : 'No'}
Paused: ${tokenInfo.pause_status === 'PAUSED' ? 'Yes' : 'No'}
      `.trim();
      
      return {
        success: true,
        message: formattedInfo
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      return {
        success: false,
        message: `Error retrieving token information: ${error.message}`
      };
    }
  }
}

// Singleton instance
let elizaPlugin = null;

/**
 * Get the Eliza Hedera Plugin instance
 * @returns {ElizaHederaPlugin} The plugin instance
 */
function getElizaPlugin() {
  if (!elizaPlugin) {
    elizaPlugin = new ElizaHederaPlugin();
  }
  return elizaPlugin;
}

module.exports = {
  getElizaPlugin,
  processElizaQuery: async (userId, query) => {
    const plugin = getElizaPlugin();
    return await plugin.processQuery(userId, query);
  }
};