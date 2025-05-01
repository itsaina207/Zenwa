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
      const tokenIdMatches = normalizedQuery.match(/0\.0\.\d+/g) || [];
      const tokenIds = tokenIdMatches.map(id => id.trim());
      const tokenId = tokenIds.length > 0 ? tokenIds[0] : null;
      
      // ElizaOS-style airdrop command (format: "Airdrop X tokens 0.0.XXX to wallets: 0.0.YYY, 0.0.ZZZ")
      if (normalizedQuery.includes('airdrop') && normalizedQuery.includes('token') && normalizedQuery.includes('to wallet')) {
        console.log('[ELIZA] Detected airdrop command');
        
        // Extract amount, token ID, and recipient accounts
        const amountMatch = normalizedQuery.match(/airdrop\s+(\d+)\s+tokens?/i);
        const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
        
        // Extract recipient accounts
        const recipientsMatch = normalizedQuery.match(/to wallet(?:s)?:\s*([0-9., ]+)/i);
        const recipientsList = recipientsMatch ? 
          recipientsMatch[1].split(',').map(acc => acc.trim()).filter(acc => acc.match(/0\.0\.\d+/)) : 
          [];
        
        if (tokenIds.length > 0 && amount > 0 && recipientsList.length > 0) {
          return {
            success: true,
            message: `💡 Pour créer un airdrop de ${amount} tokens ${tokenIds[0]} vers ${recipientsList.length} comptes, utilisez la commande /airdrop et suivez les instructions interactives du bot.\n\nFormez votre requête en indiquant le token ID, le montant, et les comptes destinataires.`
          };
        }
      }
      
      // ElizaOS-style "Show pending airdrops" command
      if ((normalizedQuery.includes('show') || normalizedQuery.includes('list') || normalizedQuery.includes('afficher') || 
           normalizedQuery.includes('montrer') || normalizedQuery.includes('voir')) && 
          normalizedQuery.includes('pending') && normalizedQuery.includes('airdrop')) {
        console.log('[ELIZA] Detected show pending airdrops command');
        
        return {
          success: true,
          message: `📩 Pour voir les airdrops disponibles, utilisez la commande /claimairdrop du bot, qui vous montrera la liste des airdrops en attente que vous pouvez réclamer.`
        };
      }
      
      // ElizaOS-style "Claim airdrop" command
      if ((normalizedQuery.includes('claim') || normalizedQuery.includes('accept') || 
           normalizedQuery.includes('réclamer') || normalizedQuery.includes('reclaimer')) && 
          normalizedQuery.includes('airdrop') && tokenIds.length > 0) {
        console.log('[ELIZA] Detected claim airdrop command');
        
        return {
          success: true,
          message: `📥 Pour réclamer un airdrop spécifique, utilisez la commande /claimairdrop du bot, puis sélectionnez l'airdrop correspondant au token ${tokenIds[0]} dans la liste qui s'affichera.`
        };
      }
      
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
      
      // Show token balance for a specific account (format: "Show me balance of token 0.0.XXX for wallet 0.0.YYY")
      if (normalizedQuery.match(/balance.+token.+wallet/i) && tokenIds.length > 0) {
        const walletMatch = normalizedQuery.match(/wallet\s+(0\.0\.\d+)/i);
        const walletId = walletMatch ? walletMatch[1].trim() : null;
        
        if (tokenId && walletId) {
          console.log(`[ELIZA] Detected token balance query for specific account: ${walletId}, token: ${tokenId}`);
          return {
            success: true,
            message: `🔍 Pour vérifier le solde d'un token spécifique (${tokenId}) pour un compte précis (${walletId}), je vous invite à utiliser l'explorateur HashScan:\n\n[Voir les tokens détenus par ce compte](https://hashscan.io/testnet/account/${walletId}/tokens)`
          };
        }
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
      console.log(`[ELIZA] Getting token owners for token: ${tokenId}`);
      // Validate token ID format
      if (!tokenId.match(/^0\.0\.\d+$/)) {
        return {
          success: false,
          message: "Format d'ID de token invalide. Veuillez utiliser le format 0.0.XXXXX"
        };
      }
      
      // Query the mirror node for token holders with proper limit
      try {
        // Use the dedicated function from mirror-node.js
        const { getTokenHolders } = require('../hedera/mirror-node');
        const tokenHolders = await getTokenHolders(tokenId, 100);
        
        if (!tokenHolders || !tokenHolders.balances) {
          console.error(`[ELIZA] No balances found for token ${tokenId}`);
          return {
            success: false,
            message: `Impossible de récupérer les informations sur les détenteurs du token ${tokenId}.`
          };
        }
        
        const balances = tokenHolders.balances;
        console.log(`[ELIZA] Found ${balances.length} holders for token ${tokenId}`);
        
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
        // Fallback direct method if the helper function fails
        console.error(`[ELIZA] Error using getTokenHolders function: ${error.message}, trying direct API call`);
        
        const response = await mirrorNodeClient.get(`/tokens/${tokenId}/balances?limit=100`);
        
        if (!response.data || !response.data.balances) {
          return {
            success: false,
            message: `Impossible de récupérer les informations sur les détenteurs du token ${tokenId}.`
          };
        }
        
        const balances = response.data.balances;
        console.log(`[ELIZA] Found ${balances.length} holders for token ${tokenId} (direct method)`);
        
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
      }
    } catch (error) {
      console.error(`[ELIZA] Error getting token owners: ${error.message}`);
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