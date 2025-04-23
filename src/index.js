/**
 * Hedera Custodial Wallet with Telegram Bot Integration
 * Main application entry point
 */

const express = require('express');
const { createBot } = require('./telegram/bot');
const { initClient } = require('./hedera/client');
const { PORT, NODE_ENV } = require('./config');
const apiRoutes = require('./api');

// Initialize Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: NODE_ENV });
});

// API routes for testing
app.use('/api', apiRoutes);

// Initialize Hedera client
initClient();

// Start Telegram bot
const bot = createBot();

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Telegram bot started');
  console.log(`API available at http://0.0.0.0:${PORT}/api`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
