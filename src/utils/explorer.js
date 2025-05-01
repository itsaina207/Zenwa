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
  // URL de base de HashScan
  const hashScanBase = network.toLowerCase() === 'mainnet' 
    ? 'https://hashscan.io/mainnet' 
    : 'https://hashscan.io/testnet';
  
  // Construire le chemin en fonction du type
  let hashScanPath = '';
  
  switch (type) {
    case 'transaction':
      hashScanPath = `/transaction/${id}`;
      break;
    case 'token':
      hashScanPath = `/token/${id}`;
      break;
    case 'account':
      hashScanPath = `/account/${id}`;
      break;
    case 'topic':
      hashScanPath = `/topic/${id}`;
      break;
    default:
      hashScanPath = `/dashboard?search=${id}`;
  }
  
  // Pour maintenir la compatibilité avec le code existant, nous retournons toujours un objet
  // avec hederaExplorer et hashScan, mais nous utilisons uniquement hashScan
  return {
    hashScan: `${hashScanBase}${hashScanPath}`,
    hederaExplorer: `${hashScanBase}${hashScanPath}` // Utiliser HashScan pour les deux
  };
}

/**
 * Fonction simplifiée pour générer un lien d'explorateur
 * @param {string} id - ID de la ressource (transaction, token, etc.)
 * @param {string} type - Type de ressource ('transaction', 'token', 'account', 'topic')
 * @returns {string} URL de l'explorateur
 */
function explorerUrl(id, type = 'transaction') {
  const urls = getExplorerUrls(id, type);
  return urls.hashScan;
}

module.exports = {
  getExplorerUrls,
  explorerUrl
};