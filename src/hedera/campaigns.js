/**
 * Module de gestion des campagnes d'airdrop
 * Permet de créer et gérer des campagnes de distribution de tokens
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { 
  TokenTransferTransaction,
  TokenId
} = require('@hashgraph/sdk');
const { getClient } = require('./client');
const { getAccountInfo } = require('./account');
const { getExplorerUrls } = require('../utils/explorer');

// Chemin du fichier de stockage des campagnes
const CAMPAIGNS_FILE = path.join(__dirname, '../data/airdrop_campaigns.json');

/**
 * Charger les campagnes depuis le fichier
 * @returns {Array} Liste des campagnes
 */
function loadCampaigns() {
  try {
    // Créer le fichier s'il n'existe pas
    if (!fs.existsSync(CAMPAIGNS_FILE)) {
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify({ campaigns: [] }));
      return [];
    }
    
    const data = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
    const { campaigns } = JSON.parse(data);
    return campaigns || [];
  } catch (error) {
    console.error('Erreur lors du chargement des campagnes:', error);
    return [];
  }
}

/**
 * Sauvegarder les campagnes dans le fichier
 * @param {Array} campaigns - Liste des campagnes à sauvegarder
 */
function saveCampaigns(campaigns) {
  try {
    const data = JSON.stringify({ campaigns }, null, 2);
    fs.writeFileSync(CAMPAIGNS_FILE, data, 'utf8');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des campagnes:', error);
  }
}

/**
 * Créer une nouvelle campagne d'airdrop
 * @param {string} creatorId - ID Telegram du créateur de la campagne
 * @param {Object} campaignInfo - Informations sur la campagne
 * @returns {Object} Résultat de la création
 */
function createCampaign(creatorId, campaignInfo) {
  try {
    const { tokenId, name, description, amountPerUser, totalAmount, endDate } = campaignInfo;
    
    // Valider les informations
    if (!tokenId || !name || !description || !amountPerUser || !totalAmount || !endDate) {
      return {
        success: false,
        message: 'Informations de campagne incomplètes'
      };
    }
    
    // Créer la campagne
    const campaign = {
      id: uuidv4(),
      creatorId,
      tokenId,
      name,
      description,
      amountPerUser,
      totalAmount,
      claimedAmount: 0,
      participants: [],
      createdAt: new Date().toISOString(),
      endDate,
      status: 'active'  // active, paused, completed, cancelled
    };
    
    // Charger les campagnes existantes et ajouter la nouvelle
    const campaigns = loadCampaigns();
    campaigns.push(campaign);
    saveCampaigns(campaigns);
    
    return {
      success: true,
      message: 'Campagne créée avec succès',
      campaignId: campaign.id
    };
  } catch (error) {
    console.error('Erreur lors de la création de la campagne:', error);
    return {
      success: false,
      message: `Erreur lors de la création de la campagne: ${error.message}`
    };
  }
}

/**
 * Récupérer une campagne par son ID
 * @param {string} campaignId - ID de la campagne
 * @returns {Object|null} Campagne trouvée ou null
 */
function getCampaign(campaignId) {
  const campaigns = loadCampaigns();
  return campaigns.find(campaign => campaign.id === campaignId) || null;
}

/**
 * Récupérer toutes les campagnes actives
 * @returns {Array} Liste des campagnes actives
 */
function getActiveCampaigns() {
  const campaigns = loadCampaigns();
  return campaigns.filter(campaign => campaign.status === 'active');
}

/**
 * Récupérer les campagnes créées par un utilisateur
 * @param {string} creatorId - ID Telegram du créateur
 * @returns {Array} Liste des campagnes de l'utilisateur
 */
function getUserCampaigns(creatorId) {
  const campaigns = loadCampaigns();
  return campaigns.filter(campaign => campaign.creatorId === creatorId);
}

/**
 * Réclamer des tokens d'une campagne
 * @param {string} userId - ID Telegram de l'utilisateur qui réclame
 * @param {string} campaignId - ID de la campagne
 * @returns {Promise<Object>} Résultat de la réclamation
 */
async function claimFromCampaign(userId, campaignId) {
  try {
    // Récupérer la campagne
    const campaigns = loadCampaigns();
    const campaignIndex = campaigns.findIndex(campaign => campaign.id === campaignId);
    
    if (campaignIndex === -1) {
      return {
        success: false,
        message: 'Campagne non trouvée'
      };
    }
    
    const campaign = campaigns[campaignIndex];
    
    // Vérifier que la campagne est active
    if (campaign.status !== 'active') {
      return {
        success: false,
        message: 'Cette campagne n\'est pas active'
      };
    }
    
    // Vérifier que l'utilisateur n'a pas déjà réclamé
    if (campaign.participants.includes(userId)) {
      return {
        success: false,
        message: 'Vous avez déjà réclamé des tokens de cette campagne'
      };
    }
    
    // Vérifier qu'il reste suffisamment de tokens
    if (campaign.claimedAmount + campaign.amountPerUser > campaign.totalAmount) {
      return {
        success: false,
        message: 'Plus de tokens disponibles dans cette campagne'
      };
    }
    
    // Récupérer les informations du compte créateur
    const creatorAccountInfo = await getAccountInfo(campaign.creatorId);
    if (!creatorAccountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations du compte du créateur: ${creatorAccountInfo.message}`
      };
    }
    
    // Récupérer les informations du compte de l'utilisateur
    const userAccountInfo = await getAccountInfo(userId);
    if (!userAccountInfo.success) {
      return {
        success: false,
        message: `Impossible de récupérer les informations de votre compte: ${userAccountInfo.message}`
      };
    }
    
    const { accountId: creatorAccountId, privateKey: creatorPrivateKey } = creatorAccountInfo;
    const { accountId: userAccountId } = userAccountInfo;
    const client = getClient();
    
    // Convertir en objets Hedera SDK
    const tokenIdObj = TokenId.fromString(campaign.tokenId);
    
    // Créer la transaction de transfert
    const txTransfer = await new TokenTransferTransaction()
      .addTokenTransfer(tokenIdObj, creatorAccountId, -campaign.amountPerUser)
      .addTokenTransfer(tokenIdObj, userAccountId, campaign.amountPerUser)
      .freezeWith(client);
      
    // Signer avec la clé privée du créateur
    const signedTx = await txTransfer.sign(creatorPrivateKey);
    
    // Soumettre la transaction
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const txId = txResponse.transactionId.toString();
    
    // Mettre à jour la campagne
    campaign.claimedAmount += campaign.amountPerUser;
    campaign.participants.push(userId);
    
    // Si tous les tokens ont été réclamés, marquer la campagne comme terminée
    if (campaign.claimedAmount >= campaign.totalAmount) {
      campaign.status = 'completed';
    }
    
    // Sauvegarder les modifications
    campaigns[campaignIndex] = campaign;
    saveCampaigns(campaigns);
    
    // Préparer le résultat avec les liens vers les explorateurs
    const result = {
      success: true,
      message: 'Tokens réclamés avec succès',
      transactionId: txId,
      tokenId: campaign.tokenId,
      amount: campaign.amountPerUser,
      status: receipt.status.toString()
    };
    
    // Ajouter les liens vers les explorateurs
    try {
      const explorerUrls = getExplorerUrls(txId, 'transaction');
      result.explorerUrl = explorerUrls.hederaExplorer;
      result.hashscanUrl = explorerUrls.hashScan;
    } catch (error) {
      console.warn(`Erreur lors de la génération des liens d'explorateur: ${error.message}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Erreur lors de la réclamation de tokens:', error);
    return {
      success: false,
      message: `Erreur lors de la réclamation de tokens: ${error.message}`
    };
  }
}

/**
 * Mettre à jour le statut d'une campagne
 * @param {string} creatorId - ID Telegram du créateur de la campagne
 * @param {string} campaignId - ID de la campagne
 * @param {string} newStatus - Nouveau statut ('active', 'paused', 'completed', 'cancelled')
 * @returns {Object} Résultat de la mise à jour
 */
function updateCampaignStatus(creatorId, campaignId, newStatus) {
  try {
    // Vérifier que le statut est valide
    const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        message: 'Statut invalide'
      };
    }
    
    // Récupérer la campagne
    const campaigns = loadCampaigns();
    const campaignIndex = campaigns.findIndex(campaign => campaign.id === campaignId);
    
    if (campaignIndex === -1) {
      return {
        success: false,
        message: 'Campagne non trouvée'
      };
    }
    
    const campaign = campaigns[campaignIndex];
    
    // Vérifier que l'utilisateur est bien le créateur
    if (campaign.creatorId !== creatorId) {
      return {
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette campagne'
      };
    }
    
    // Mettre à jour le statut
    campaign.status = newStatus;
    campaigns[campaignIndex] = campaign;
    saveCampaigns(campaigns);
    
    return {
      success: true,
      message: 'Statut de la campagne mis à jour avec succès',
      newStatus
    };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    return {
      success: false,
      message: `Erreur lors de la mise à jour du statut: ${error.message}`
    };
  }
}

module.exports = {
  createCampaign,
  getCampaign,
  getActiveCampaigns,
  getUserCampaigns,
  claimFromCampaign,
  updateCampaignStatus
};