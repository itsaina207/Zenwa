/**
 * Application configuration
 * Loads environment variables
 */

require('dotenv').config();

// Common configuration
module.exports = {
  PORT: process.env.PORT || 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Telegram configuration - Support des 2 noms de variables
  TELEGRAM_BOT_TOKEN: process.env.ZENWA_TELEGRAM || process.env.TELEGRAM_BOT_TOKEN,
  
  // OpenAI configuration pour le traitement du langage naturel
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Hedera configuration
  HEDERA_NETWORK: process.env.HEDERA_NETWORK || 'testnet',
  
  // Hedera Account Information - AI Kit
  ACCOUNT_ID: process.env.HEDERA_AI_KIT_ACCOUNT_ID,
  EVM_ADDRESS: process.env.HEDERA_AI_KIT_EVM_ADDRESS,
  HEX_ENCODED_PRIVATE_KEY: process.env.HEDERA_AI_KIT_PRIVATE_KEY,
  DER_ENCODED_PRIVATE_KEY: process.env.HEDERA_AI_KIT_PRIVATE_KEY,
  DER_ENCODED_PUBLIC_KEY: process.env.HEDERA_AI_KIT_PUBLIC_KEY,
  
  // Backward compatibility
  HEDERA_OPERATOR_ID: process.env.HEDERA_AI_KIT_ACCOUNT_ID,
  HEDERA_OPERATOR_KEY: process.env.HEDERA_AI_KIT_PRIVATE_KEY,
  
  // Mirror node API
  MIRROR_NODE_URL: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com/api/v1',
  
  // Agent Kit configuration
  HEDERA_AI_KIT_ACCOUNT_ID: process.env.HEDERA_AI_KIT_ACCOUNT_ID,
  HEDERA_AI_KIT_PRIVATE_KEY: process.env.HEDERA_AI_KIT_PRIVATE_KEY,
  HEDERA_AI_KIT_PUBLIC_KEY: process.env.HEDERA_AI_KIT_PUBLIC_KEY,
  HEDERA_AI_KIT_EVM_ADDRESS: process.env.HEDERA_AI_KIT_EVM_ADDRESS,
};
