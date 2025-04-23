/**
 * Utilitaires pour interagir avec les APIs Hedera (Mirror Nodes)
 */

// Configuration
const config = require('../config');

/**
 * Crée l'URL de base pour l'API Mirror Node selon le réseau
 * @param {string} networkType - Type de réseau ('mainnet', 'testnet', 'previewnet')
 * @returns {string} URL de base de l'API Mirror Node
 */
function createBaseMirrorNodeApiUrl(networkType) {
  const networkName = networkType || config.HEDERA_NETWORK || 'testnet';
  const networkBase = networkName === 'mainnet' ? `${networkName}-public` : networkName;
  return `https://${networkBase}.mirrornode.hedera.com`;
}

/**
 * Formate une réponse de l'API Mirror Node
 * @param {Object} response - Réponse brute de l'API
 * @param {string} entityType - Type d'entité (account, transaction, token, etc.)
 * @returns {Object} Réponse formatée
 */
function formatMirrorNodeResponse(response, entityType) {
  switch (entityType) {
    case 'account':
      return formatAccountResponse(response);
    case 'transaction':
      return formatTransactionResponse(response);
    case 'token':
      return formatTokenResponse(response);
    case 'topic':
      return formatTopicResponse(response);
    default:
      return response;
  }
}

/**
 * Formate une réponse d'information de compte
 * @param {Object} response - Réponse brute de l'API
 * @returns {Object} Informations de compte formatées
 */
function formatAccountResponse(response) {
  if (!response || !response.account) {
    return { success: false, message: 'Compte non trouvé' };
  }
  
  const account = response.account;
  return {
    success: true,
    accountId: account.account,
    balance: account.balance.balance / 100000000, // Conversion en HBAR
    createdAt: new Date(account.created_timestamp).toISOString(),
    isDeleted: account.deleted,
    key: account.key ? account.key.key : null,
    expiresAt: account.expiry_timestamp ? new Date(account.expiry_timestamp).toISOString() : null,
    autoRenewPeriod: account.auto_renew_period,
    maxAutoTokenAssociations: account.max_automatic_token_associations,
    memoBase64: account.memo,
    memo: account.memo ? Buffer.from(account.memo, 'base64').toString('utf8') : '',
  };
}

/**
 * Formate une réponse de transaction
 * @param {Object} response - Réponse brute de l'API
 * @returns {Object} Informations de transaction formatées
 */
function formatTransactionResponse(response) {
  if (!response || !response.transactions || response.transactions.length === 0) {
    return { success: false, message: 'Transactions non trouvées' };
  }
  
  const transactions = response.transactions.map(tx => {
    const timestamp = new Date(tx.consensus_timestamp * 1000).toISOString();
    const txId = `${tx.transaction_id}`;
    
    // Déterminer le type de transaction
    let type = 'UNKNOWN';
    if (tx.name && tx.name.includes('TOKENCREATION')) {
      type = 'TOKENCREATION';
    } else if (tx.name && tx.name.includes('CRYPTOTRANSFER')) {
      type = 'CRYPTOTRANSFER';
    } else if (tx.name) {
      type = tx.name.replace('CRYPTO', '').replace('HCS', '').replace('TOKEN', '');
    }
    
    return {
      id: txId,
      timestamp,
      type,
      result: tx.result === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      fee: tx.charged_tx_fee / 100000000,
      memo: tx.memo_base64 ? Buffer.from(tx.memo_base64, 'base64').toString('utf8') : '',
    };
  });
  
  return {
    success: true,
    count: transactions.length,
    transactions
  };
}

/**
 * Formate une réponse d'information de token
 * @param {Object} response - Réponse brute de l'API
 * @returns {Object} Informations de token formatées
 */
function formatTokenResponse(response) {
  if (!response || !response.tokens || response.tokens.length === 0) {
    return { success: false, message: 'Token non trouvé' };
  }
  
  const token = response.tokens[0];
  return {
    success: true,
    tokenId: token.token_id,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    totalSupply: token.total_supply,
    maxSupply: token.max_supply || null,
    createdAt: new Date(token.created_timestamp).toISOString(),
    modifiedAt: token.modified_timestamp ? new Date(token.modified_timestamp).toISOString() : null,
    type: token.type,
    supplyType: token.supply_type,
    isDeleted: token.deleted,
    treasuryAccountId: token.treasury_account_id,
    memo: token.memo,
  };
}

/**
 * Formate une réponse d'information de topic
 * @param {Object} response - Réponse brute de l'API
 * @returns {Object} Informations de topic formatées
 */
function formatTopicResponse(response) {
  if (!response || !response.topics || response.topics.length === 0) {
    return { success: false, message: 'Topic non trouvé' };
  }
  
  const topic = response.topics[0];
  return {
    success: true,
    topicId: topic.topic_id,
    adminKey: topic.admin_key,
    submitKey: topic.submit_key,
    autoRenewPeriod: topic.auto_renew_period,
    expirationTime: topic.expiration_time ? new Date(topic.expiration_time).toISOString() : null,
    memo: topic.memo,
    sequenceNumber: topic.sequence_number,
    createdAt: new Date(topic.created_timestamp).toISOString(),
    messageCount: topic.message_count || 0,
  };
}

module.exports = {
  createBaseMirrorNodeApiUrl,
  formatMirrorNodeResponse,
};