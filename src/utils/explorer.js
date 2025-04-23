/**
 * Utilitaires pour générer des liens vers les explorateurs blockchain Hedera
 */

// Configuration
const config = require('../config');

/**
 * Types d'entités supportés
 * @type {Object}
 */
const ENTITY_TYPES = {
  account: 'account',
  transaction: 'transaction', 
  token: 'token',
  topic: 'topic',
  contract: 'contract',
  nft: 'nft',
};

/**
 * URLs de base des explorateurs selon le réseau
 * @type {Object}
 */
const EXPLORER_BASE_URLS = {
  mainnet: {
    hederaExplorer: 'https://hederaexplorer.io',
    hashScan: 'https://hashscan.io/mainnet',
  },
  testnet: {
    hederaExplorer: 'https://testnet.hederaexplorer.io',
    hashScan: 'https://hashscan.io/testnet',
  },
  previewnet: {
    hederaExplorer: 'https://previewnet.hederaexplorer.io',
    hashScan: 'https://hashscan.io/previewnet',
  },
};

/**
 * Chemins des URLs selon le type d'entité et l'explorateur
 * @type {Object}
 */
const URL_PATHS = {
  hederaExplorer: {
    account: 'account',
    transaction: 'transaction',
    token: 'token',
    topic: 'topic',
    contract: 'contract',
    nft: 'nft',
  },
  hashScan: {
    account: 'account',
    transaction: 'tx',
    token: 'token',
    topic: 'topic',
    contract: 'contract',
    nft: 'token', // HashScan utilise /token/{tokenId}/nfts pour les NFTs
  },
};

/**
 * Génère des URLs pour les explorateurs Hedera
 * @param {string} entityId - ID de l'entité (accountId, transactionId, tokenId, etc.)
 * @param {string} entityType - Type d'entité (account, transaction, token, etc.)
 * @param {string} [network] - Réseau (mainnet, testnet, previewnet)
 * @returns {Object} URLs pour les différents explorateurs
 */
function getExplorerUrls(entityId, entityType, network) {
  // Valider le type d'entité
  if (!Object.values(ENTITY_TYPES).includes(entityType)) {
    throw new Error(`Type d'entité non valide: ${entityType}`);
  }
  
  // Déterminer le réseau
  const networkName = network || config.HEDERA_NETWORK || 'testnet';
  
  // Récupérer les URLs de base
  const baseUrls = EXPLORER_BASE_URLS[networkName];
  if (!baseUrls) {
    throw new Error(`Réseau non pris en charge: ${networkName}`);
  }
  
  // Construire les URLs
  return {
    hederaExplorer: `${baseUrls.hederaExplorer}/${URL_PATHS.hederaExplorer[entityType]}/${entityId}`,
    hashScan: `${baseUrls.hashScan}/${URL_PATHS.hashScan[entityType]}/${entityId}`,
  };
}

module.exports = {
  getExplorerUrls,
  ENTITY_TYPES,
};