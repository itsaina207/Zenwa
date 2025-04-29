/**
 * Hedera Custodial Wallet with Telegram Bot Integration
 * Main application entry point
 */

const express = require('express');
const { createBot } = require('./telegram/bot');
const { initClient } = require('./hedera/client');
const { PORT, NODE_ENV } = require('./config');
const apiRoutes = require('./api');

// Process-wide error handling
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Continue running despite the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at Promise:', promise, 'reason:', reason);
  // Continue running despite the error
});

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
try {
  initClient();
  console.log('Hedera client initialized successfully');
} catch (error) {
  console.error('Error initializing Hedera client:', error);
  // Continue despite errors
}

// Start Telegram bot
let bot = null;
try {
  bot = createBot();
  console.log('Telegram bot started successfully');
} catch (error) {
  console.error('Error starting Telegram bot:', error);
  // Continue despite errors
}

// Start Express server
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://0.0.0.0:${PORT}/api`);
  });
} catch (error) {
  console.error('Error starting Express server:', error);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
