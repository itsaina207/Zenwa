/**
 * Module de gestion des campagnes d'airdrop
 * Permet de créer et gérer des campagnes de distribution de tokens
 */

const fs = require('fs');
const path = require('path');
const { createTokenAirdrop } = require('./airdrop');

// Chemin vers le fichier de stockage des campagnes
const CAMPAIGNS_FILE = path.join(__dirname, '../data/airdrop_campaigns.json');

// Assurer que le répertoire data existe
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialiser le fichier de campagnes s'il n'existe pas
if (!fs.existsSync(CAMPAIGNS_FILE)) {
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify({ campaigns: [] }, null, 2));
}

/**
 * Charger les campagnes depuis le fichier
 * @returns {Array} Liste des campagnes
 */
function loadCampaigns() {
  try {
    const data = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
    return JSON.parse(data).campaigns || [];
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
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify({ campaigns }, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des campagnes:', error);
    return false;
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
    const campaigns = loadCampaigns();
    
    // Générer un ID unique pour la campagne
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Créer la nouvelle campagne
    const newCampaign = {
      id: campaignId,
      creatorId,
      name: campaignInfo.name,
      description: campaignInfo.description,
      tokenId: campaignInfo.tokenId,
      totalAmount: campaignInfo.totalAmount,
      amountPerClaim: campaignInfo.amountPerClaim,
      maxClaims: campaignInfo.maxClaims || 0, // 0 = illimité
      remainingAmount: campaignInfo.totalAmount,
      claimCount: 0,
      status: 'active',
      claimedBy: [],
      pendingAirdropIds: [],
      createdAt: new Date().toISOString()
    };
    
    // Ajouter la campagne à la liste
    campaigns.push(newCampaign);
    
    // Sauvegarder les campagnes
    const saved = saveCampaigns(campaigns);
    
    if (saved) {
      return {
        success: true,
        message: 'Campagne d\'airdrop créée avec succès',
        campaignId,
        campaign: newCampaign
      };
    } else {
      return {
        success: false,
        message: 'Erreur lors de la sauvegarde de la campagne'
      };
    }
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
  try {
    const campaigns = loadCampaigns();
    return campaigns.find(campaign => campaign.id === campaignId) || null;
  } catch (error) {
    console.error('Erreur lors de la récupération de la campagne:', error);
    return null;
  }
}

/**
 * Récupérer toutes les campagnes actives
 * @returns {Array} Liste des campagnes actives
 */
function getActiveCampaigns() {
  try {
    const campaigns = loadCampaigns();
    return campaigns.filter(campaign => campaign.status === 'active');
  } catch (error) {
    console.error('Erreur lors de la récupération des campagnes actives:', error);
    return [];
  }
}

/**
 * Récupérer les campagnes créées par un utilisateur
 * @param {string} creatorId - ID Telegram du créateur
 * @returns {Array} Liste des campagnes de l'utilisateur
 */
function getUserCampaigns(creatorId) {
  try {
    const campaigns = loadCampaigns();
    return campaigns.filter(campaign => campaign.creatorId === creatorId);
  } catch (error) {
    console.error('Erreur lors de la récupération des campagnes de l\'utilisateur:', error);
    return [];
  }
}

/**
 * Réclamer des tokens d'une campagne
 * @param {string} userId - ID Telegram de l'utilisateur qui réclame
 * @param {string} campaignId - ID de la campagne
 * @returns {Promise<Object>} Résultat de la réclamation
 */
async function claimFromCampaign(userId, campaignId) {
  try {
    // Charger les campagnes
    const campaigns = loadCampaigns();
    const campaignIndex = campaigns.findIndex(c => c.id === campaignId);
    
    if (campaignIndex === -1) {
      return {
        success: false,
        message: 'Campagne introuvable'
      };
    }
    
    const campaign = campaigns[campaignIndex];
    
    // Vérifier si la campagne est active
    if (campaign.status !== 'active') {
      return {
        success: false,
        message: `Cette campagne n'est pas active (statut: ${campaign.status})`
      };
    }
    
    // Vérifier si l'utilisateur a déjà réclamé
    if (campaign.claimedBy.includes(userId)) {
      return {
        success: false,
        message: 'Vous avez déjà réclamé des tokens de cette campagne'
      };
    }
    
    // Vérifier s'il reste des tokens à distribuer
    if (campaign.remainingAmount <= 0) {
      campaign.status = 'completed';
      saveCampaigns(campaigns);
      return {
        success: false,
        message: 'Cette campagne a distribué tous les tokens disponibles'
      };
    }
    
    // Vérifier si le nombre maximum de réclamations est atteint
    if (campaign.maxClaims > 0 && campaign.claimCount >= campaign.maxClaims) {
      campaign.status = 'completed';
      saveCampaigns(campaigns);
      return {
        success: false,
        message: 'Le nombre maximum de réclamations pour cette campagne a été atteint'
      };
    }
    
    // Effectuer l'airdrop
    const result = await createTokenAirdrop(
      campaign.creatorId,
      campaign.tokenId,
      [{ accountId: userId, amount: campaign.amountPerClaim }]
    );
    
    if (result.success) {
      // Mettre à jour la campagne
      campaign.claimedBy.push(userId);
      campaign.claimCount += 1;
      campaign.remainingAmount -= campaign.amountPerClaim;
      
      if (result.pendingAirdropId) {
        campaign.pendingAirdropIds.push(result.pendingAirdropId);
      }
      
      // Vérifier s'il faut clôturer la campagne
      if (campaign.remainingAmount <= 0 || 
         (campaign.maxClaims > 0 && campaign.claimCount >= campaign.maxClaims)) {
        campaign.status = 'completed';
      }
      
      // Sauvegarder les modifications
      campaigns[campaignIndex] = campaign;
      saveCampaigns(campaigns);
      
      return {
        success: true,
        message: `Vous avez réclamé ${campaign.amountPerClaim} tokens avec succès`,
        tokenId: campaign.tokenId,
        amount: campaign.amountPerClaim,
        transactionId: result.transactionId,
        explorerUrl: result.explorerUrl,
        hashscanUrl: result.hashscanUrl,
        pendingAirdropId: result.pendingAirdropId
      };
    } else {
      return {
        success: false,
        message: `Erreur lors de la réclamation: ${result.message}`
      };
    }
  } catch (error) {
    console.error('Erreur lors de la réclamation depuis la campagne:', error);
    return {
      success: false,
      message: `Erreur lors de la réclamation: ${error.message}`
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
    const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        message: `Statut invalide. Les statuts valides sont: ${validStatuses.join(', ')}`
      };
    }
    
    const campaigns = loadCampaigns();
    const campaignIndex = campaigns.findIndex(c => c.id === campaignId);
    
    if (campaignIndex === -1) {
      return {
        success: false,
        message: 'Campagne introuvable'
      };
    }
    
    const campaign = campaigns[campaignIndex];
    
    // Vérifier que c'est bien le créateur qui fait la modification
    if (campaign.creatorId !== creatorId) {
      return {
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette campagne'
      };
    }
    
    // Mettre à jour le statut
    campaign.status = newStatus;
    campaigns[campaignIndex] = campaign;
    
    // Sauvegarder les modifications
    const saved = saveCampaigns(campaigns);
    
    if (saved) {
      return {
        success: true,
        message: `Statut de la campagne mis à jour: ${newStatus}`,
        campaign
      };
    } else {
      return {
        success: false,
        message: 'Erreur lors de la sauvegarde du statut'
      };
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la campagne:', error);
    return {
      success: false,
      message: `Erreur lors de la mise à jour: ${error.message}`
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