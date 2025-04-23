/**
 * API endpoints for testing the Hedera wallet functionality
 */

const express = require('express');
const { createAccount, getBalance, sendHbar } = require('./hedera/account');
const { getTransactionHistory } = require('./hedera/transactions');
const { mintToken, sendToken } = require('./hedera/tokens');

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

module.exports = router;