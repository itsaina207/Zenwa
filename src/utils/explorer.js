/**
 * Utilitaire pour la génération des liens vers les explorateurs de blockchain Hedera
 */

/**
 * Génère les URLs pour les explorateurs Hedera
 * @param {string} id - ID de la ressource (transaction, token, compte, topic, etc.)
 * @param {string} type - Type de ressource ('transaction', 'token', 'account', 'topic')
 * @param {string} network - Réseau Hedera ('testnet' ou 'mainnet')
 * @returns {Object} URLs des explorateurs
 */
function getExplorerUrls(id, type, network = 'testnet') {
  // URLs de base des explorateurs
  const baseUrls = {
    testnet: {
      hederaExplorer: 'https://testnet.hederaexplorer.io',
      hashScan: 'https://hashscan.io/testnet'
    },
    mainnet: {
      hederaExplorer: 'https://hederaexplorer.io',
      hashScan: 'https://hashscan.io/mainnet'
    }
  };
  
  const { hederaExplorer, hashScan } = baseUrls[network];
  
  // Construire les chemins en fonction du type
  let hederaPath = '';
  let hashScanPath = '';
  
  switch (type) {
    case 'transaction':
      hederaPath = `/search/transaction/${id}`;
      hashScanPath = `/transaction/${id}`;
      break;
    case 'token':
      hederaPath = `/search/token/${id}`;
      hashScanPath = `/token/${id}`;
      break;
    case 'account':
      hederaPath = `/search/account/${id}`;
      hashScanPath = `/account/${id}`;
      break;
    case 'topic':
      hederaPath = `/search/topic/${id}`;
      hashScanPath = `/topic/${id}`;
      break;
    default:
      hederaPath = `/search/${id}`;
      hashScanPath = `/dashboard?search=${id}`;
  }
  
  return {
    hederaExplorer: `${hederaExplorer}${hederaPath}`,
    hashScan: `${hashScan}${hashScanPath}`
  };
}

module.exports = {
  getExplorerUrls
};