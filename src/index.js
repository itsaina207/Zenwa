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

// Auto-ping system to keep the application alive 24/7
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let pingCounter = 0;

const autoPing = () => {
  pingCounter++;
  console.log(`[KEEP-ALIVE] Auto-ping #${pingCounter} at ${new Date().toISOString()}`);
  
  // Simulate a health check request to keep the app active
  try {
    const https = require('https');
    const url = process.env.REPLIT_SLUG ? 
      `https://${process.env.REPLIT_SLUG}.${process.env.REPLIT_OWNER}.repl.co/health` : 
      `http://localhost:${PORT}/health`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`[KEEP-ALIVE] Health check successful: ${data}`);
        } else {
          console.error(`[KEEP-ALIVE] Health check failed with status: ${res.statusCode}`);
        }
      });
    }).on('error', (err) => {
      console.error(`[KEEP-ALIVE] Health check error: ${err.message}`);
    });
  } catch (error) {
    console.error(`[KEEP-ALIVE] Auto-ping error: ${error.message}`);
  }
};

// Set up regular pinging
setInterval(autoPing, PING_INTERVAL);

// Start Express server
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://0.0.0.0:${PORT}/api`);
    
    // Initial ping to make sure it's working
    setTimeout(autoPing, 10000);
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
