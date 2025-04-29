/**
 * Mirror Node Client for Hedera
 * Provides access to Hedera mirror node data
 */

const axios = require('axios');
const { getNetworkConfig } = require('./client');

// Mirror node base URLs for different networks
const MIRROR_NODE_URLS = {
  mainnet: 'https://mainnet-public.mirrornode.hedera.com/api/v1',
  testnet: 'https://testnet.mirrornode.hedera.com/api/v1',
  previewnet: 'https://previewnet.mirrornode.hedera.com/api/v1'
};

// Default axios client instance
let mirrorNodeClient = null;

/**
 * Initialize and get the mirror node client
 * @returns {Object} Axios instance for making mirror node requests
 */
function getMirrorNodeClient() {
  if (!mirrorNodeClient) {
    const networkConfig = getNetworkConfig();
    const baseURL = MIRROR_NODE_URLS[networkConfig.network] || MIRROR_NODE_URLS.testnet;
    
    mirrorNodeClient = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add response interceptor for logging
    mirrorNodeClient.interceptors.response.use(
      response => {
        if (process.env.DEBUG_MIRROR_NODE === 'true') {
          console.log(`[Mirror Node Response] ${response.config.url}: `, 
            response.status, 
            response.data ? 'Data received' : 'No data'
          );
        }
        return response;
      },
      error => {
        console.error(`[Mirror Node Error] ${error.config?.url || 'Unknown URL'}: `, 
          error.response?.status || 'No status', 
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
    
    console.log(`Mirror node client initialized for ${networkConfig.network}`);
  }
  
  return mirrorNodeClient;
}

/**
 * Get account information from mirror node
 * @param {string} accountId - Hedera account ID
 * @returns {Promise<object>} Account information
 */
async function getAccountInfo(accountId) {
  const client = getMirrorNodeClient();
  try {
    const response = await client.get(`/accounts/${accountId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching account info for ${accountId}:`, error.message);
    throw error;
  }
}

/**
 * Get token information from mirror node
 * @param {string} tokenId - Hedera token ID
 * @returns {Promise<object>} Token information
 */
async function getTokenInfo(tokenId) {
  const client = getMirrorNodeClient();
  try {
    const response = await client.get(`/tokens/${tokenId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching token info for ${tokenId}:`, error.message);
    throw error;
  }
}

/**
 * Get transaction details from mirror node
 * @param {string} transactionId - Hedera transaction ID
 * @returns {Promise<object>} Transaction details
 */
async function getTransactionById(transactionId) {
  const client = getMirrorNodeClient();
  try {
    const response = await client.get(`/transactions/${transactionId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching transaction ${transactionId}:`, error.message);
    throw error;
  }
}

/**
 * Get token holders from mirror node
 * @param {string} tokenId - Hedera token ID
 * @param {number} limit - Maximum number of holders to return
 * @returns {Promise<object>} Token holders information
 */
async function getTokenHolders(tokenId, limit = 100) {
  const client = getMirrorNodeClient();
  try {
    const response = await client.get(`/tokens/${tokenId}/balances?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getMirrorNodeClient,
  getAccountInfo,
  getTokenInfo,
  getTransactionById,
  getTokenHolders
};