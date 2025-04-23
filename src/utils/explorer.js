/**
 * Utilitaires pour la génération de liens vers le Hedera Explorer
 */

/**
 * Formats utilisés pour générer des liens vers le Hedera Explorer
 * @type {Object}
 */
const EXPLORER_URLS = {
  // Hedera Explorer officiel
  TESTNET: {
    transaction: 'https://testnet.hederaexplorer.io/tx/{id}',
    token: 'https://testnet.hederaexplorer.io/token/{id}',
    account: 'https://testnet.hederaexplorer.io/accounts/{id}',
    topic: 'https://testnet.hederaexplorer.io/topic/{id}'
  },
  MAINNET: {
    transaction: 'https://hederaexplorer.io/tx/{id}',
    token: 'https://hederaexplorer.io/token/{id}',
    account: 'https://hederaexplorer.io/accounts/{id}',
    topic: 'https://hederaexplorer.io/topic/{id}'
  },
  // HashScan Explorer (alternative)
  HASHSCAN_TESTNET: {
    transaction: 'https://hashscan.io/testnet/transaction/{id}',
    token: 'https://hashscan.io/testnet/token/{id}',
    account: 'https://hashscan.io/testnet/account/{id}',
    topic: 'https://hashscan.io/testnet/topic/{id}'
  },
  HASHSCAN_MAINNET: {
    transaction: 'https://hashscan.io/mainnet/transaction/{id}',
    token: 'https://hashscan.io/mainnet/token/{id}',
    account: 'https://hashscan.io/mainnet/account/{id}',
    topic: 'https://hashscan.io/mainnet/topic/{id}'
  }
};

/**
 * Récupère l'URL de l'explorateur de blocs Hedera pour l'ID d'un objet
 * @param {string} type - Type d'objet ('transaction', 'token', 'account', 'topic')
 * @param {string} id - Identifiant de l'objet
 * @param {string} network - Réseau ('testnet' ou 'mainnet')
 * @param {string} explorer - Explorateur à utiliser ('hedera' ou 'hashscan')
 * @returns {string} URL vers l'explorateur de blocs
 */
function getExplorerUrl(type, id, network = 'testnet', explorer = 'hedera') {
  // Normaliser le type pour correspondre aux clés de l'objet
  const normalizedType = type.toLowerCase();
  
  // Sélectionner le bon explorateur
  let explorerType;
  if (explorer.toLowerCase() === 'hashscan') {
    explorerType = network.toLowerCase() === 'mainnet' ? 'HASHSCAN_MAINNET' : 'HASHSCAN_TESTNET';
  } else {
    explorerType = network.toLowerCase() === 'mainnet' ? 'MAINNET' : 'TESTNET';
  }
  
  // S'assurer que le type d'objet est valide
  if (!EXPLORER_URLS[explorerType][normalizedType]) {
    throw new Error(`Type d'objet non pris en charge: ${type}`);
  }
  
  // Générer l'URL avec l'ID
  const url = EXPLORER_URLS[explorerType][normalizedType].replace('{id}', id);
  
  return url;
}

module.exports = {
  getExplorerUrl
};