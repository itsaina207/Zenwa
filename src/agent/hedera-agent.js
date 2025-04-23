/**
 * Hedera Agent - Natural Language Processing for Hedera operations
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
      'transfer token',
      'associate token',
      'dissociate token',
      'create topic',
      'submit message to topic'
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

      // Déterminer l'intention à partir de la commande en langage naturel à l'aide du LLM
      const intent = await this.determineIntent(userId, command);
      console.log('Detected intent:', intent);
      
      // Exécuter l'action appropriée en fonction de l'intention
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
        
        // Nouvelles fonctionnalités du Hedera Agent Kit
        case 'associate_token':
          return await this.associateToken(userId, intent.params.tokenId);
          
        case 'dissociate_token':
          return await this.dissociateToken(userId, intent.params.tokenId);
          
        case 'create_topic':
          return await this.createTopic(
            userId, 
            intent.params.topicName, 
            intent.params.submitKey === true
          );
          
        case 'submit_message':
          return await this.submitTopicMessage(
            userId,
            intent.params.topicId,
            intent.params.message
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
      // Utiliser l'intégration Hedera Agent Kit
      const { checkHbarBalance, checkTokenBalances } = require('./hedera-agent-kit-integration');
      const { getUserTokens } = require('../hedera/tokens');
      
      // Récupérer le solde HBAR via Agent Kit
      const hbarResult = await checkHbarBalance(userId);
      
      // Si échec, utiliser l'implémentation standard
      if (!hbarResult.success) {
        const { getBalance } = require('../hedera/account');
        return await getBalance(userId);
      }
      
      // Récupérer les soldes de tokens via Agent Kit ou notre implémentation
      const tokensResult = await checkTokenBalances(userId);
      
      // Combiner les résultats
      const result = {
        success: true,
        balance: {
          hbars: hbarResult.balance?.hbars || "0",
          tokens: tokensResult.success ? tokensResult.tokens : {}
        },
        accountId: hbarResult.accountId
      };
      
      // Récupérer les informations des tokens pour l'affichage
      const userTokens = await getUserTokens(userId);
      const tokenMap = {};
      
      // Créer un mapping des IDs de tokens vers leurs noms
      if (userTokens && userTokens.length > 0) {
        userTokens.forEach(token => {
          tokenMap[token.token_id] = `${token.token_name} (${token.token_symbol})`;
        });
      }
      
      let tokenList = "";
      if (typeof result.balance.tokens === 'string') {
        tokenList = result.balance.tokens;
      } else if (result.balance.tokens) {
        // Afficher les tokens avec leur nom et symbole si disponibles
        tokenList = Object.entries(result.balance.tokens)
          .map(([tokenId, amount]) => {
            const tokenName = tokenMap[tokenId] || tokenId;
            return `${tokenName}: ${amount}`;
          })
          .join('\n');
        
        if (!tokenList) tokenList = 'Aucun token';
      }
      
      return {
        success: true,
        message: `Votre solde est de ${result.balance.hbars} avec les tokens suivants:\n${tokenList}`,
        data: { 
          balance: result.balance, 
          accountId: result.accountId,
          tokens: userTokens || []
        }
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
      // Utiliser l'intégration Hedera Agent Kit
      const { sendHbar } = require('./hedera-agent-kit-integration');
      const { getExplorerUrl } = require('../utils/explorer');
      const result = await sendHbar(userId, recipientId, amount);
      
      // Générer les URLs des explorateurs pour la transaction
      let explorerUrls = {};
      if (result.success && result.transactionId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      // Formater la réponse
      return {
        success: result.success,
        message: result.success ? 
          `Transaction réussie ! Vous avez envoyé ${amount} HBAR à ${recipientId}.\n` +
          `ID de transaction: ${result.transactionId}\n` +
          `Voir sur: ${explorerUrls.hederaExplorer}` : 
          (result.message || "Erreur lors de l'envoi de HBAR"),
        data: result.success ? { 
          transactionId: result.transactionId,
          amount,
          recipient: recipientId,
          explorerUrls
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
      // Utiliser l'intégration Hedera Agent Kit
      const { getTransactionHistory } = require('./hedera-agent-kit-integration');
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
      // Utiliser l'intégration Hedera Agent Kit
      const { createFungibleToken } = require('./hedera-agent-kit-integration');
      const { getExplorerUrl } = require('../utils/explorer');
      
      const trimmedName = name.trim();
      let trimmedSymbol = symbol ? symbol.trim().toUpperCase() : '';
      
      // Si le symbole n'est pas fourni, générer un symbole à partir du nom
      if (!trimmedSymbol) {
        // Générer un symbole à partir du nom (les 3-4 premières lettres ou les initiales si c'est un nom composé)
        if (trimmedName.includes(' ')) {
          // Nom composé, utiliser les initiales
          trimmedSymbol = trimmedName.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('');
          
          // Limiter à 5 caractères maximum
          trimmedSymbol = trimmedSymbol.substring(0, 5);
        } else {
          // Nom simple, prendre les 3-4 premières lettres
          trimmedSymbol = trimmedName.substring(0, 4).toUpperCase();
        }
        
        console.log(`Symbole généré automatiquement: ${trimmedSymbol} pour le token: ${trimmedName}`);
      }
      
      // Create token info object
      const tokenInfo = {
        name: trimmedName,
        symbol: trimmedSymbol,
        decimals: 0,
        initialSupply: 1000,
        supplyType: "INFINITE"
      };
      
      const result = await createFungibleToken(userId, tokenInfo);
      
      // Générer les URLs des explorateurs (Hedera Explorer et HashScan)
      let explorerUrls = {};
      if (result.success && result.tokenId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('token', result.tokenId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('token', result.tokenId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      // Formater la réponse
      return {
        success: result.success,
        message: result.success ? 
          `Token créé avec succès ! Nom: ${tokenInfo.name}, Symbole: ${tokenInfo.symbol}, ID: ${result.tokenId}\n` + 
          `Voir sur: ${explorerUrls.hederaExplorer}` : 
          (result.message || "Erreur lors de la création du token"),
        data: result.success ? { 
          tokenId: result.tokenId,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          explorerUrls: explorerUrls
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
   * @param {string} tokenIdOrName - ID or name of the token to transfer
   * @param {number} amount - Amount of tokens to transfer
   * @returns {Promise<object>} Transaction result
   */
  async transferToken(userId, recipientId, tokenIdOrName, amount) {
    try {
      // Utiliser l'intégration Hedera Agent Kit pour le transfert
      const { transferToken } = require('./hedera-agent-kit-integration');
      const { getTokenIdByNameOrSymbol } = require('../hedera/tokens');
      const { getExplorerUrl } = require('../utils/explorer');
      
      // Check if tokenIdOrName is a name or symbol instead of an ID
      let actualTokenId = tokenIdOrName;
      let tokenName = tokenIdOrName;
      
      // If it doesn't look like a Hedera token ID (0.0.xxx format), try to get the ID by name
      if (!tokenIdOrName.match(/^\d+\.\d+\.\d+$/)) {
        const tokenId = await getTokenIdByNameOrSymbol(userId, tokenIdOrName);
        if (tokenId) {
          actualTokenId = tokenId;
        } else {
          return {
            success: false,
            message: `Token "${tokenIdOrName}" non trouvé. Veuillez utiliser un ID de token valide ou créer d'abord ce token.`
          };
        }
      }
      
      const result = await transferToken(userId, recipientId, actualTokenId, amount);
      
      // Générer les URLs des explorateurs pour la transaction
      let explorerUrls = {};
      if (result.success && result.transactionId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      // Formater la réponse
      return {
        success: result.success,
        message: result.success ? 
          `Transaction réussie ! Vous avez envoyé ${amount} tokens ${tokenName} (${actualTokenId}) à ${recipientId}.\n` +
          `ID de transaction: ${result.transactionId}\n` +
          `Voir sur: ${explorerUrls.hederaExplorer}` : 
          (result.message || "Erreur lors de l'envoi des tokens"),
        data: result.success ? { 
          transactionId: result.transactionId,
          amount,
          tokenId: actualTokenId,
          tokenName,
          recipient: recipientId,
          explorerUrls
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
  
  /**
   * Associate a token with a user account
   * @param {string} userId - User's Telegram ID
   * @param {string} tokenId - Token ID to associate
   * @returns {Promise<object>} Operation result
   */
  async associateToken(userId, tokenId) {
    try {
      const { associateToken } = require('../hedera/token-management');
      const { getExplorerUrl } = require('../utils/explorer');
      const result = await associateToken(userId, tokenId);
      
      // Générer les URLs des explorateurs pour la transaction
      let explorerUrls = {};
      if (result.success && result.transactionId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      return {
        success: result.success,
        message: result.success 
          ? `Token ${tokenId} associé avec succès à votre compte.\n` +
            `Transaction: ${result.transactionId}\n` +
            `Voir sur: ${explorerUrls.hederaExplorer}` 
          : (result.message || "Erreur lors de l'association du token"),
        data: result.success ? { 
          transactionId: result.transactionId,
          tokenId: tokenId,
          explorerUrls
        } : null
      };
    } catch (error) {
      console.error(`Error associating token: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de l'association du token: ${error.message}`
      };
    }
  }
  
  /**
   * Dissociate a token from a user account
   * @param {string} userId - User's Telegram ID
   * @param {string} tokenId - Token ID to dissociate
   * @returns {Promise<object>} Operation result
   */
  async dissociateToken(userId, tokenId) {
    try {
      const { dissociateToken } = require('../hedera/token-management');
      const { getExplorerUrl } = require('../utils/explorer');
      const result = await dissociateToken(userId, tokenId);
      
      // Générer les URLs des explorateurs pour la transaction
      let explorerUrls = {};
      if (result.success && result.transactionId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      return {
        success: result.success,
        message: result.success 
          ? `Token ${tokenId} dissocié avec succès de votre compte.\n` +
            `Transaction: ${result.transactionId}\n` +
            `Voir sur: ${explorerUrls.hederaExplorer}` 
          : (result.message || "Erreur lors de la dissociation du token"),
        data: result.success ? { 
          transactionId: result.transactionId,
          tokenId: tokenId,
          explorerUrls
        } : null
      };
    } catch (error) {
      console.error(`Error dissociating token: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de la dissociation du token: ${error.message}`
      };
    }
  }
  
  /**
   * Create a new HCS topic
   * @param {string} userId - User's Telegram ID
   * @param {string} topicName - Name for the new topic
   * @param {boolean} submitKey - Whether to use a submit key for the topic
   * @returns {Promise<object>} Operation result
   */
  async createTopic(userId, topicName, submitKey = false) {
    try {
      const { createTopic } = require('../hedera/topic-management');
      const { getExplorerUrl } = require('../utils/explorer');
      const result = await createTopic(userId, topicName, submitKey);
      
      // Générer les URLs des explorateurs pour le topic
      let explorerUrls = {};
      if (result.success && result.topicId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('topic', result.topicId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('topic', result.topicId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      return {
        success: result.success,
        message: result.success 
          ? `Topic "${topicName}" créé avec succès, ID: ${result.topicId}\n` +
            `Voir sur: ${explorerUrls.hederaExplorer}` 
          : (result.message || "Erreur lors de la création du topic"),
        data: result.success ? { 
          transactionId: result.transactionId,
          topicId: result.topicId,
          topicName: topicName,
          explorerUrls: explorerUrls
        } : null
      };
    } catch (error) {
      console.error(`Error creating topic: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de la création du topic: ${error.message}`
      };
    }
  }
  
  /**
   * Submit message to an HCS topic
   * @param {string} userId - User's Telegram ID
   * @param {string} topicId - Topic ID to submit to
   * @param {string} message - Message content
   * @returns {Promise<object>} Operation result
   */
  async submitTopicMessage(userId, topicId, message) {
    try {
      const { submitTopicMessage } = require('../hedera/topic-management');
      const { getExplorerUrl } = require('../utils/explorer');
      const result = await submitTopicMessage(userId, topicId, message);
      
      // Générer les URLs des explorateurs pour la transaction
      let explorerUrls = {};
      if (result.success && result.transactionId) {
        try {
          explorerUrls = {
            hederaExplorer: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hedera'),
            hashScan: getExplorerUrl('transaction', result.transactionId, 'testnet', 'hashscan')
          };
        } catch (error) {
          console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
        }
      }
      
      return {
        success: result.success,
        message: result.success 
          ? `Message soumis avec succès au topic ${topicId}\n` +
            `Transaction: ${result.transactionId}\n` +
            `Voir sur: ${explorerUrls.hederaExplorer}` 
          : (result.message || "Erreur lors de la soumission du message"),
        data: result.success ? { 
          transactionId: result.transactionId,
          topicId: topicId,
          explorerUrls: explorerUrls
        } : null
      };
    } catch (error) {
      console.error(`Error submitting message: ${error.message}`);
      return {
        success: false,
        message: `Erreur lors de la soumission du message: ${error.message}`
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