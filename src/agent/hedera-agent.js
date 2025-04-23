/**
 * Hedera Agent - Integration with Hedera Agent Kit
 * Provides natural language processing for Hedera blockchain operations
 */

const { Client } = require('@hashgraph/sdk');
const { getClient } = require('../hedera/client');
const { getWalletByUserId } = require('../storage/userWallets');

/**
 * HederaAgent class for managing natural language interactions with Hedera
 */
class HederaAgent {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.supportedActions = [
      'check balance',
      'transfer HBAR',
      'get transaction history',
      'create token',
      'transfer token'
    ];
  }

  /**
   * Initialize the Hedera agent
   * @returns {boolean} Success status
   */
  initialize() {
    try {
      this.client = getClient();
      this.initialized = true;
      console.log('✅ Hedera Agent initialized successfully');
      return true;
    } catch (error) {
      console.error(`❌ Failed to initialize Hedera Agent: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute a natural language command
   * @param {string} userId - Telegram user ID
   * @param {string} command - Natural language command
   * @returns {Promise<object>} Result of the command execution
   */
  async executeCommand(userId, command) {
    if (!this.initialized) {
      const success = this.initialize();
      if (!success) {
        return {
          success: false,
          message: "Agent non initialisé. Impossible d'exécuter la commande."
        };
      }
    }

    try {
      const wallet = await getWalletByUserId(userId);
      if (!wallet) {
        return {
          success: false,
          message: "Vous n'avez pas encore de wallet. Veuillez créer un wallet d'abord avec /createwallet."
        };
      }

      // Determine intent from natural language command using LLM
      const intent = await this.determineIntent(userId, command);
      console.log('Detected intent:', intent);
      
      // Execute the appropriate action based on intent
      switch (intent.action) {
        case 'balance':
          return await this.checkBalance(userId);
          
        case 'send_hbar':
          return await this.transferHBAR(userId, intent.params.recipient, intent.params.amount);
          
        case 'history':
          return await this.getTransactionHistory(userId, intent.params.limit || 10);
          
        case 'mint_token':
          return await this.createToken(userId, intent.params.name, intent.params.symbol);
          
        case 'send_token':
          return await this.transferToken(
            userId, 
            intent.params.recipient, 
            intent.params.tokenId, 
            intent.params.amount
          );
          
        default:
          return {
            success: false,
            message: "Je ne comprends pas cette commande. Voici les actions que je peux effectuer: " + 
                    this.supportedActions.join(", ") + "."
          };
      }
    } catch (error) {
      console.error(`Error executing command: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de l'exécution de la commande: ${error.message}`
      };
    }
  }

  /**
   * Determine the intent from a natural language command
   * @param {string} userId - Telegram user ID
   * @param {string} command - Natural language command
   * @returns {Promise<object>} Intent object with action and parameters
   */
  async determineIntent(userId, command) {
    try {
      // Utiliser le service LLM pour analyser la commande
      const { analyzeIntent } = require('../services/llm-service');
      const result = await analyzeIntent(userId, command);
      
      if (result.success) {
        return {
          action: result.action,
          params: result.params
        };
      } else {
        console.error(`Erreur lors de l'analyse LLM: ${result.error}`);
        return { action: 'unknown', params: {} };
      }
    } catch (error) {
      console.error(`Erreur dans determineIntent: ${error.message}`);
      return { action: 'unknown', params: {} };
    }
  }

  /**
   * Check balance for a user
   * @param {string} userId - Telegram user ID
   * @returns {Promise<object>} Balance information
   */
  async checkBalance(userId) {
    try {
      const { getBalance } = require('../hedera/account');
      const result = await getBalance(userId);
      
      return {
        success: result.success,
        message: result.success ? 
          `Votre solde est de ${result.balance} HBAR` : 
          (result.message || "Erreur lors de la récupération du solde"),
        data: result.success ? { balance: result.balance } : null
      };
    } catch (error) {
      console.error(`Error checking balance: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de la vérification du solde: ${error.message}`
      };
    }
  }

  /**
   * Transfer HBAR to another account
   * @param {string} userId - Sender's Telegram user ID
   * @param {string} recipientId - Recipient's account ID
   * @param {string|number} amount - Amount of HBAR to send
   * @returns {Promise<object>} Transaction result
   */
  async transferHBAR(userId, recipientId, amount) {
    try {
      const { sendHbar } = require('../hedera/account');
      const result = await sendHbar(userId, recipientId, amount.toString());
      
      return {
        success: result.success,
        message: result.success ? 
          `Transaction réussie ! Vous avez envoyé ${amount} HBAR à ${recipientId}. ID de transaction: ${result.transactionId}` : 
          (result.message || "Erreur lors de l'envoi de HBAR"),
        data: result.success ? { 
          transactionId: result.transactionId,
          amount,
          recipient: recipientId
        } : null
      };
    } catch (error) {
      console.error(`Error transferring HBAR: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors du transfert de HBAR: ${error.message}`
      };
    }
  }

  /**
   * Get transaction history for a user
   * @param {string} userId - Telegram user ID
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<object>} Transaction history
   */
  async getTransactionHistory(userId, limit = 10) {
    try {
      const { getTransactionHistory } = require('../hedera/transactions');
      const result = await getTransactionHistory(userId, limit);
      
      if (result.success) {
        if (result.transactions.length === 0) {
          return {
            success: true,
            message: "Vous n'avez pas encore effectué de transactions.",
            data: { transactions: [] }
          };
        }
        
        // Format transactions for display
        const formattedTxs = result.transactions.map((tx, index) => 
          `${index + 1}. Type: ${tx.type}, Montant: ${tx.amount}, Date: ${new Date(tx.timestamp).toLocaleString()}`
        ).join('\n');
        
        return {
          success: true,
          message: `Vos ${result.transactions.length} dernières transactions:\n${formattedTxs}`,
          data: { transactions: result.transactions }
        };
      } else {
        return {
          success: false,
          message: result.message || "Erreur lors de la récupération de l'historique"
        };
      }
    } catch (error) {
      console.error(`Error getting transaction history: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de la récupération de l'historique: ${error.message}`
      };
    }
  }

  /**
   * Create a new token
   * @param {string} userId - Token creator's Telegram user ID
   * @param {string} name - Token name
   * @param {string} symbol - Token symbol
   * @returns {Promise<object>} Token creation result
   */
  async createToken(userId, name, symbol) {
    try {
      const { mintToken } = require('../hedera/tokens');
      
      // Create token info object
      const tokenInfo = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals: 0,
        initialSupply: 1000,
        supplyType: "INFINITE"
      };
      
      const result = await mintToken(userId, tokenInfo);
      
      return {
        success: result.success,
        message: result.success ? 
          `Token créé avec succès ! Nom: ${tokenInfo.name}, Symbole: ${tokenInfo.symbol}, ID: ${result.tokenId}` : 
          (result.message || "Erreur lors de la création du token"),
        data: result.success ? { 
          tokenId: result.tokenId,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol
        } : null
      };
    } catch (error) {
      console.error(`Error creating token: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de la création du token: ${error.message}`
      };
    }
  }

  /**
   * Transfer tokens to another account
   * @param {string} userId - Sender's Telegram user ID
   * @param {string} recipientId - Recipient's account ID
   * @param {string} tokenId - ID of the token to transfer
   * @param {number} amount - Amount of tokens to transfer
   * @returns {Promise<object>} Transaction result
   */
  async transferToken(userId, recipientId, tokenId, amount) {
    try {
      const { sendToken } = require('../hedera/tokens');
      const result = await sendToken(userId, recipientId, tokenId, amount);
      
      return {
        success: result.success,
        message: result.success ? 
          `Transaction réussie ! Vous avez envoyé ${amount} tokens ${tokenId} à ${recipientId}. ID de transaction: ${result.transactionId}` : 
          (result.message || "Erreur lors de l'envoi des tokens"),
        data: result.success ? { 
          transactionId: result.transactionId,
          amount,
          tokenId,
          recipient: recipientId
        } : null
      };
    } catch (error) {
      console.error(`Error transferring tokens: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors du transfert des tokens: ${error.message}`
      };
    }
  }
}

// Singleton instance
let agentInstance = null;

/**
 * Get the HederaAgent instance (singleton)
 * @returns {HederaAgent} Agent instance
 */
function getAgent() {
  if (!agentInstance) {
    agentInstance = new HederaAgent();
    agentInstance.initialize();
  }
  return agentInstance;
}

module.exports = {
  getAgent
};