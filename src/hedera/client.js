/**
 * Hedera client initialization and management
 */

const {
  Client,
  AccountId,
  PrivateKey,
} = require('@hashgraph/sdk');
const { 
  HEDERA_NETWORK, 
  ACCOUNT_ID, 
  HEX_ENCODED_PRIVATE_KEY,
  DER_ENCODED_PRIVATE_KEY,
  DER_ENCODED_PUBLIC_KEY,
  EVM_ADDRESS,
} = require('../config');

let client = null;
let networkConfig = null;

/**
 * Initialize Hedera client with operator credentials
 */
const initClient = () => {
  if (client) return client;

  if (!ACCOUNT_ID || !HEX_ENCODED_PRIVATE_KEY) {
    throw new Error('Hedera operator credentials missing. Check your environment variables.');
  }

  try {
    const operatorId = AccountId.fromString(ACCOUNT_ID);
    // Try to parse the private key in different formats
    let operatorKey;
    try {
      // First try as ECDSA (hex)
      operatorKey = PrivateKey.fromStringECDSA(HEX_ENCODED_PRIVATE_KEY);
    } catch (e) {
      try {
        // Then try as DER
        operatorKey = PrivateKey.fromString(HEX_ENCODED_PRIVATE_KEY);
      } catch (e2) {
        // Finally try as raw string
        operatorKey = PrivateKey.fromString(HEX_ENCODED_PRIVATE_KEY);
      }
    }

    // Create client based on network setting
    const network = HEDERA_NETWORK.toLowerCase();
    networkConfig = { network }; // Store network info for mirror node use
    
    switch (network) {
      case 'mainnet':
        client = Client.forMainnet();
        break;
      case 'testnet':
        client = Client.forTestnet();
        break;
      case 'previewnet':
        client = Client.forPreviewnet();
        break;
      default:
        networkConfig.network = 'testnet';
        client = Client.forTestnet();
    }

    // Set operator account and key
    client.setOperator(operatorId, operatorKey);
    
    console.log(`Hedera client initialized for ${HEDERA_NETWORK}`);
    return client;
  } catch (error) {
    console.error(`Failed to initialize Hedera client: ${error.message}`);
    throw error;
  }
};

/**
 * Get the initialized Hedera client
 */
const getClient = () => {
  if (!client) {
    return initClient();
  }
  return client;
};

/**
 * Get the network configuration
 * @returns {Object} Network configuration object with network property
 */
const getNetworkConfig = () => {
  if (!networkConfig) {
    // Initialize client which will set the networkConfig
    initClient();
  }
  return networkConfig;
};

module.exports = {
  initClient,
  getClient,
  getNetworkConfig,
};
