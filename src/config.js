/**
 * Application configuration
 * Loads environment variables
 */

require('dotenv').config();

// Common configuration
module.exports = {
  PORT: process.env.PORT || 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Telegram configuration
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  
  // Hedera configuration
  HEDERA_NETWORK: process.env.HEDERA_NETWORK || 'testnet',
  
  // Hedera Account Information
  ACCOUNT_ID: process.env.ACCOUNT_ID,
  EVM_ADDRESS: process.env.EVM_ADDRESS,
  HEX_ENCODED_PRIVATE_KEY: process.env.HEX_ENCODED_PRIVATE_KEY,
  DER_ENCODED_PRIVATE_KEY: process.env.DER_ENCODED_PRIVATE_KEY,
  DER_ENCODED_PUBLIC_KEY: process.env.DER_ENCODED_PUBLIC_KEY,
  
  // Backward compatibility
  HEDERA_OPERATOR_ID: process.env.ACCOUNT_ID,
  HEDERA_OPERATOR_KEY: process.env.HEX_ENCODED_PRIVATE_KEY,
  
  // Mirror node API
  MIRROR_NODE_URL: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com/api/v1',
};
