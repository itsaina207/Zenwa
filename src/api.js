/**
 * API endpoints for testing the Hedera wallet functionality
 * Including Hedera Agent Kit integrations for advanced operations
 */

const express = require('express');
const { createAccount, getBalance, sendHbar } = require('./hedera/account');
const { getTransactionHistory } = require('./hedera/transactions');
const { mintToken, sendToken } = require('./hedera/tokens');
const { associateToken, dissociateToken } = require('./hedera/token-management');
const { createTopic, submitTopicMessage, getTopicMessages } = require('./hedera/topic-management');
const { getAgent } = require('./agent/hedera-agent');
const { analyzeIntent } = require('./services/llm-service');
const { initializeAgentKit, getAgentKit } = require('./agent/hedera-agent-kit-adapter');
const { getWalletByUserId } = require('./storage/userWallets');

const router = express.Router();

/**
 * Create a new wallet
 * POST /api/wallet/create
 */
router.post('/wallet/create', async (req, res) => {
  try {
    const userId = req.body.userId || 'test-user-' + Date.now();
    const result = await createAccount(userId);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Create Wallet: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to create wallet: ${error.message}`,
    });
  }
});

/**
 * Get wallet balance
 * GET /api/wallet/balance/:userId
 */
router.get('/wallet/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await getBalance(userId);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Get Balance: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get balance: ${error.message}`,
    });
  }
});

/**
 * Send HBAR to another account
 * POST /api/wallet/send
 */
router.post('/wallet/send', async (req, res) => {
  try {
    const { fromUserId, toAccountId, amount } = req.body;
    
    if (!fromUserId || !toAccountId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: fromUserId, toAccountId, amount',
      });
    }
    
    const result = await sendHbar(fromUserId, toAccountId, amount);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Send HBAR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to send HBAR: ${error.message}`,
    });
  }
});

/**
 * Get transaction history
 * GET /api/wallet/history/:userId
 */
router.get('/wallet/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit || 10, 10);
    const result = await getTransactionHistory(userId, limit);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Get History: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get transaction history: ${error.message}`,
    });
  }
});

/**
 * Mint a new token
 * POST /api/wallet/mint
 */
router.post('/wallet/mint', async (req, res) => {
  try {
    const { userId, tokenInfo } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: userId',
      });
    }
    
    const result = await mintToken(userId, tokenInfo);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Mint Token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to mint token: ${error.message}`,
    });
  }
});

/**
 * Send token to another account
 * POST /api/wallet/sendtoken
 */
router.post('/wallet/sendtoken', async (req, res) => {
  try {
    const { fromUserId, toAccountId, tokenId, amount } = req.body;
    
    if (!fromUserId || !toAccountId || !tokenId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: fromUserId, toAccountId, tokenId, amount',
      });
    }
    
    const result = await sendToken(fromUserId, toAccountId, tokenId, amount);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Send Token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to send token: ${error.message}`,
    });
  }
});

/**
 * Associate a token with a user account
 * POST /api/wallet/associate
 */
router.post('/wallet/associate', async (req, res) => {
  try {
    const { userId, tokenId } = req.body;
    
    if (!userId || !tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, tokenId',
      });
    }
    
    const result = await associateToken(userId, tokenId);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Associate Token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to associate token: ${error.message}`,
    });
  }
});

/**
 * Dissociate a token from a user account
 * POST /api/wallet/dissociate
 */
router.post('/wallet/dissociate', async (req, res) => {
  try {
    const { userId, tokenId } = req.body;
    
    if (!userId || !tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, tokenId',
      });
    }
    
    const result = await dissociateToken(userId, tokenId);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Dissociate Token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to dissociate token: ${error.message}`,
    });
  }
});

/**
 * Create a new HCS topic
 * POST /api/hcs/topic
 */
router.post('/hcs/topic', async (req, res) => {
  try {
    const { userId, topicName, submitKey = false } = req.body;
    
    if (!userId || !topicName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, topicName',
      });
    }
    
    const result = await createTopic(userId, topicName, submitKey);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Create Topic: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to create topic: ${error.message}`,
    });
  }
});

/**
 * Submit a message to an HCS topic
 * POST /api/hcs/message
 */
router.post('/hcs/message', async (req, res) => {
  try {
    const { userId, topicId, message } = req.body;
    
    if (!userId || !topicId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, topicId, message',
      });
    }
    
    const result = await submitTopicMessage(userId, topicId, message);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Submit Topic Message: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to submit message to topic: ${error.message}`,
    });
  }
});

/**
 * Get messages from an HCS topic
 * GET /api/hcs/messages/:topicId
 */
router.get('/hcs/messages/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { userId, network = 'testnet' } = req.query;
    
    if (!userId || !topicId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, topicId',
      });
    }
    
    const result = await getTopicMessages(userId, topicId, network);
    res.json(result);
  } catch (error) {
    console.error(`API Error - Get Topic Messages: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get topic messages: ${error.message}`,
    });
  }
});

/**
 * Process natural language commands
 * POST /api/nlp/process
 */
router.post('/nlp/process', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, message',
      });
    }
    
    console.log(`Processing natural language command from ${userId}: "${message}"`);
    
    // Analyser l'intention avec le service LLM
    const intentResult = await analyzeIntent(userId, message);
    
    if (!intentResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to analyze intent: ${intentResult.error}`,
      });
    }
    
    // Exécuter la commande via l'agent Hedera
    const agent = getAgent();
    const result = await agent.executeCommand(userId, message);
    
    res.json({
      success: result.success,
      message: result.message,
      action: result.action || intentResult.action,
      data: result.data || {}
    });
  } catch (error) {
    console.error(`API Error - Process NLP: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to process natural language command: ${error.message}`,
    });
  }
});

/**
 * Test natural language intent analysis only
 * POST /api/nlp/analyze
 */
router.post('/nlp/analyze', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, message',
      });
    }
    
    // Analyser l'intention avec le service LLM
    const result = await analyzeIntent(userId, message);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Analyze NLP: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to analyze natural language: ${error.message}`,
    });
  }
});

/**
 * API routes pour utiliser directement le Hedera Agent Kit sans NLP
 * Ces endpoints permettent d'accéder aux fonctionnalités du kit sans traitement du langage naturel
 */

/**
 * Vérifier le solde HBAR avec l'Agent Kit
 * GET /api/kit/balance/hbar/:userId
 */
router.get('/kit/balance/hbar/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: userId',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { getHbarBalance } = require('./agent/official-kit-adapter');
    
    // Vérifier le solde
    const result = await getHbarBalance(userId);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Get HBAR Balance: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get HBAR balance with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Transférer des HBAR avec l'Agent Kit
 * POST /api/kit/transfer/hbar
 */
router.post('/kit/transfer/hbar', async (req, res) => {
  try {
    const { fromUserId, toAccountId, amount } = req.body;
    
    if (!fromUserId || !toAccountId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: fromUserId, toAccountId, amount',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { transferHbar } = require('./agent/official-kit-adapter');
    
    // Effectuer le transfert
    const result = await transferHbar(fromUserId, toAccountId, amount);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Transfer HBAR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to transfer HBAR with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Créer un token fongible avec l'Agent Kit
 * POST /api/kit/token/create
 */
router.post('/kit/token/create', async (req, res) => {
  try {
    const { userId, name, symbol, initialSupply = 1000, decimals = 0 } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, name',
      });
    }
    
    // Générer un symbole si non fourni
    let tokenSymbol = symbol;
    if (!tokenSymbol) {
      if (name.includes(' ')) {
        // Nom composé, utiliser les initiales
        tokenSymbol = name.split(' ')
          .map(word => word.charAt(0).toUpperCase())
          .join('');
        
        // Limiter à 5 caractères maximum
        tokenSymbol = tokenSymbol.substring(0, 5);
      } else {
        // Nom simple, prendre les 3-4 premières lettres
        tokenSymbol = name.substring(0, 4).toUpperCase();
      }
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { createFungibleToken } = require('./agent/official-kit-adapter');
    
    // Options du token
    const tokenInfo = {
      name: name,
      symbol: tokenSymbol,
      decimals: decimals,
      initialSupply: initialSupply,
      supplyType: "INFINITE"
    };
    
    // Créer le token avec l'adaptateur officiel
    const result = await createFungibleToken(userId, tokenInfo);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Create Token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to create token with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Transférer des tokens avec l'Agent Kit
 * POST /api/kit/transfer/token
 */
router.post('/kit/transfer/token', async (req, res) => {
  try {
    const { fromUserId, toAccountId, tokenId, amount } = req.body;
    
    if (!fromUserId || !toAccountId || !tokenId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: fromUserId, toAccountId, tokenId, amount',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { transferToken } = require('./agent/official-kit-adapter');
    
    // Effectuer le transfert
    const result = await transferToken(fromUserId, toAccountId, tokenId, parseInt(amount, 10));
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Transfer Token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to transfer token with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Récupérer l'historique des transactions avec l'Agent Kit
 * GET /api/kit/history/:userId
 */
router.get('/kit/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit || 10, 10);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: userId',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { getTransactionHistory } = require('./agent/official-kit-adapter');
    
    // Récupérer l'historique
    const result = await getTransactionHistory(userId, limit);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Get History: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get transaction history with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Créer un topic HCS (Hedera Consensus Service) avec l'Agent Kit
 * POST /api/kit/topic/create
 */
router.post('/kit/topic/create', async (req, res) => {
  try {
    const { userId, topicMemo, isSubmitKey = false } = req.body;
    
    if (!userId || !topicMemo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, topicMemo',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { createTopic } = require('./agent/official-kit-adapter');
    
    // Créer le topic
    const result = await createTopic(userId, topicMemo, isSubmitKey);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Create Topic: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to create topic with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Soumettre un message à un topic HCS avec l'Agent Kit
 * POST /api/kit/topic/message
 */
router.post('/kit/topic/message', async (req, res) => {
  try {
    const { userId, topicId, message } = req.body;
    
    if (!userId || !topicId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, topicId, message',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { submitTopicMessage } = require('./agent/official-kit-adapter');
    
    // Soumettre le message
    const result = await submitTopicMessage(userId, topicId, message);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Submit Topic Message: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to submit topic message with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Récupérer les messages d'un topic HCS avec l'Agent Kit
 * GET /api/kit/topic/messages/:topicId
 */
router.get('/kit/topic/messages/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const limit = parseInt(req.query.limit || 10, 10);
    
    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: topicId',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { getTopicMessages } = require('./agent/official-kit-adapter');
    
    // Récupérer les messages
    const result = await getTopicMessages(topicId, limit);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Get Topic Messages: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get topic messages with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Récupérer les informations d'un topic HCS avec l'Agent Kit
 * GET /api/kit/topic/info/:topicId
 */
router.get('/kit/topic/info/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    
    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: topicId',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { getTopicInfo } = require('./agent/official-kit-adapter');
    
    // Récupérer les informations
    const result = await getTopicInfo(topicId);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Get Topic Info: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get topic info with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Récupérer les détails d'un token avec l'Agent Kit
 * GET /api/kit/token/details/:tokenId
 */
router.get('/kit/token/details/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: tokenId',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { getTokenDetails } = require('./agent/official-kit-adapter');
    
    // Récupérer les détails
    const result = await getTokenDetails(tokenId);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Get Token Details: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get token details with Agent Kit: ${error.message}`,
    });
  }
});

/**
 * Récupérer les détenteurs d'un token avec l'Agent Kit
 * GET /api/kit/token/holders/:tokenId
 */
router.get('/kit/token/holders/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const threshold = parseInt(req.query.threshold || 1, 10);
    
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: tokenId',
      });
    }
    
    // Utiliser le nouvel adaptateur officiel
    const { getTokenHolders } = require('./agent/official-kit-adapter');
    
    // Récupérer les détenteurs
    const result = await getTokenHolders(tokenId, threshold);
    
    res.json(result);
  } catch (error) {
    console.error(`API Error - Kit Get Token Holders: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to get token holders with Agent Kit: ${error.message}`,
    });
  }
});

module.exports = router;