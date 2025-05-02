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

// Endpoint pour tester si le serveur est disponible - sera remplacé plus tard

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

// Import le système keep-alive amélioré pour un fonctionnement 24/7
const { initKeepAliveSystem } = require('./keep-alive');

// Enrichir l'endpoint /health pour plus de détails
app.get('/health', (req, res) => {
  const version = '1.0.0';
  const uptime = Math.floor(process.uptime());
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
  
  res.status(200).json({
    status: 'ok',
    version,
    environment: NODE_ENV,
    uptime: uptimeFormatted,
    timestamp: new Date().toISOString(),
    telegram_bot: bot ? 'connected' : 'disconnected',
    hedera_client: 'initialized'
  });
});

// Start Express server
try {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://0.0.0.0:${PORT}/api`);
    
    // Initialize the keep-alive system for 24/7 operation
    initKeepAliveSystem(PORT);
    
    console.log(`[SERVER] Zenwa is now running 24/7 with automatic monitoring`);
  });
  
  // Add timeout handling
  server.timeout = 120000; // 2 minutes timeout
} catch (error) {
  console.error('Error starting Express server:', error);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
