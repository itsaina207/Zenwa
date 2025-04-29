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
    console.log(`[ELIZA] Processing query: "${normalizedQuery}"`);
    
    try {
      // Extract token ID if present in the query
      const tokenIdMatch = normalizedQuery.match(/0\.0\.\d+/);
      const tokenId = tokenIdMatch ? tokenIdMatch[0] : null;
      
      // Check if query is about airdrop eligibility
      if (
        (normalizedQuery.includes('eligible') && normalizedQuery.includes('airdrop')) ||
        (normalizedQuery.includes('éligib') && normalizedQuery.includes('airdrop')) ||
        (normalizedQuery.includes('eligib') && normalizedQuery.includes('airdrop')) ||
        (normalizedQuery.includes('droit') && normalizedQuery.includes('airdrop')) ||
        (normalizedQuery.includes('recevoir') && normalizedQuery.includes('airdrop'))
      ) {
        console.log('[ELIZA] Detected airdrop eligibility query');
        return await this.checkAirdropEligibility(userId);
      }
      
      // Check if query is about token ownership with token ID
      if (tokenId && (
        normalizedQuery.includes('qui') || 
        normalizedQuery.includes('who') || 
        normalizedQuery.includes('possede') || 
        normalizedQuery.includes('possède') ||
        normalizedQuery.includes('list') || 
        normalizedQuery.includes('liste') ||
        normalizedQuery.includes('détenteurs') ||
        normalizedQuery.includes('detenteurs') ||
        normalizedQuery.includes('holders') ||
        normalizedQuery.includes('propriétaire') ||
        normalizedQuery.includes('proprietaire')
      )) {
        console.log(`[ELIZA] Detected token ownership query for token: ${tokenId}`);
        return await this.getTokenOwners(tokenId);
      }
      
      // Check if query is about user's token balance
      if (
        (normalizedQuery.includes('my') || normalizedQuery.includes('mes') || normalizedQuery.includes('mon')) && 
        (normalizedQuery.includes('token') || normalizedQuery.includes('tokens')) && 
        (normalizedQuery.includes('balance') || normalizedQuery.includes('solde'))
      ) {
        console.log('[ELIZA] Detected token balance query');
        return await this.getUserTokenBalances(userId);
      }
      
      // Check if query is about token info with token ID
      if (tokenId && (
        normalizedQuery.includes('info') || 
        normalizedQuery.includes('details') || 
        normalizedQuery.includes('détails') ||
        normalizedQuery.includes('détail') ||
        normalizedQuery.includes('detail') ||
        normalizedQuery.includes('information') ||
        normalizedQuery.includes('informations')
      )) {
        console.log(`[ELIZA] Detected token info query for token: ${tokenId}`);
        return await this.getTokenInfo(tokenId);
      }
      
      // If we have a token ID but couldn't categorize the query, assume it's about token info
      if (tokenId) {
        console.log(`[ELIZA] Found token ID but no specific query type, defaulting to token info for: ${tokenId}`);
        return await this.getTokenInfo(tokenId);
      }
      
      // Default response for unrecognized queries
      console.log('[ELIZA] Query not recognized');
      return {
        success: false,
        message: "Je n'ai pas pu comprendre votre requête. Essayez de demander des informations sur l'éligibilité aux airdrops, la propriété des tokens, les soldes de tokens, ou des informations sur un token spécifique. Mentionnez toujours l'ID du token au format 0.0.XXXXX."
      };
    } catch (error) {
      console.error('Error in Eliza plugin:', error);
      return {
        success: false,
        message: `Erreur lors du traitement de votre requête: ${error.message}`
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
          message: "Vous n'avez pas encore de portefeuille. Créez-en un d'abord avec /createwallet"
        };
      }

      // Get available airdrops
      const availableAirdrops = await airdrops.getAvailableAirdrops(userId);
      
      if (availableAirdrops.length === 0) {
        return {
          success: true,
          message: "Vous n'êtes éligible à aucun airdrop pour le moment."
        };
      }
      
      // Format airdrop information
      const airdropList = availableAirdrops.map(airdrop => 
        `Token: ${airdrop.tokenId}, Montant: ${airdrop.amount}`
      ).join('\n');
      
      return {
        success: true,
        message: `Vous êtes éligible aux airdrops suivants :\n${airdropList}\n\nUtilisez /claimairdrop pour les réclamer.`
      };
    } catch (error) {
      console.error('Error checking airdrop eligibility:', error);
      return {
        success: false,
        message: `Erreur lors de la vérification de l'éligibilité aux airdrops : ${error.message}`
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
          message: "Format d'ID de token invalide. Veuillez utiliser le format 0.0.XXXXX"
        };
      }
      
      // Query the mirror node for token holders
      const response = await mirrorNodeClient.get(`/tokens/${tokenId}/balances`);
      
      if (!response.data || !response.data.balances) {
        return {
          success: false,
          message: "Impossible de récupérer les informations sur les détenteurs du token."
        };
      }
      
      const balances = response.data.balances;
      
      if (balances.length === 0) {
        return {
          success: true,
          message: `Aucun compte ne détient actuellement le token ${tokenId}.`
        };
      }
      
      // Format the token holders information
      const holdersList = balances
        .slice(0, 10) // Limit to first 10 holders
        .map(holder => `Compte: ${holder.account}, Solde: ${holder.balance}`)
        .join('\n');
        
      const totalHolders = balances.length;
      const hasMore = totalHolders > 10;
      
      return {
        success: true,
        message: `Détenteurs du token ${tokenId} (${hasMore ? 'les 10 premiers sur ' + totalHolders : totalHolders}):\n${holdersList}\n\nVoir sur HashScan: https://hashscan.io/testnet/token/${tokenId}/balances`
      };
    } catch (error) {
      console.error('Error getting token owners:', error);
      return {
        success: false,
        message: `Erreur lors de la récupération des détenteurs du token : ${error.message}`
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
          message: "Vous n'avez pas encore de portefeuille. Créez-en un d'abord avec /createwallet"
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
          message: `Vous ne possédez pas encore de tokens. Votre solde HBAR est de ${accountBalance.hbars.toString()}.`
        };
      }
      
      const balancesList = Array.from(tokenBalances.entries())
        .map(([tokenId, balance]) => `Token: ${tokenId}, Solde: ${balance} - [Voir sur HashScan](https://hashscan.io/testnet/token/${tokenId})`)
        .join('\n');
      
      const accountLink = `https://hashscan.io/testnet/account/${accountId}`;
      
      return {
        success: true,
        message: `Votre solde HBAR: ${accountBalance.hbars.toString()}\n\nVos soldes de tokens:\n${balancesList}\n\n[Voir votre compte sur HashScan](${accountLink})`
      };
    } catch (error) {
      console.error('Error getting user token balances:', error);
      return {
        success: false,
        message: `Erreur lors de la récupération de vos soldes de tokens : ${error.message}`
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
          message: "Format d'ID de token invalide. Veuillez utiliser le format 0.0.XXXXX"
        };
      }
      
      // Query the mirror node for token info
      const response = await mirrorNodeClient.get(`/tokens/${tokenId}`);
      
      if (!response.data) {
        return {
          success: false,
          message: "Impossible de récupérer les informations sur le token."
        };
      }
      
      const tokenInfo = response.data;
      
      // Format token information
      const formattedInfo = `
ID du Token: ${tokenId}
Nom: ${tokenInfo.name || 'Non spécifié'}
Symbole: ${tokenInfo.symbol || 'Non spécifié'}
Type: ${tokenInfo.type || 'Non spécifié'}
Offre Totale: ${tokenInfo.total_supply || 'Non spécifiée'}
Compte de Trésorerie: ${tokenInfo.treasury_account_id || 'Non spécifié'}
Créé le: ${new Date(tokenInfo.created_timestamp).toLocaleString() || 'Non spécifié'}
Modifié le: ${new Date(tokenInfo.modified_timestamp).toLocaleString() || 'Non spécifié'}
Frais Personnalisés: ${tokenInfo.custom_fees?.created_timestamp ? 'Oui' : 'Non'}
En Pause: ${tokenInfo.pause_status === 'PAUSED' ? 'Oui' : 'Non'}

Voir sur HashScan: https://hashscan.io/testnet/token/${tokenId}
      `.trim();
      
      return {
        success: true,
        message: formattedInfo
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      return {
        success: false,
        message: `Erreur lors de la récupération des informations sur le token : ${error.message}`
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