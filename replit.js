/**
 * Fichier de démarrage simplifié pour Replit Deployments
 * Ce fichier est utilisé comme point d'entrée principal lors du déploiement sur Replit
 */

// Importer les modules nécessaires
const express = require('express');
const path = require('path');
const { createBot } = require('./src/telegram/bot');
const { initClient } = require('./src/hedera/client');
const apiRoutes = require('./src/api');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config({ path: '.env.deployment' });

// Définir les variables de configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Gestion d'erreurs globale
process.on('uncaughtException', (error) => {
  console.error('[REPLIT-DEPLOY] UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[REPLIT-DEPLOY] UNHANDLED REJECTION at Promise:', promise, 'reason:', reason);
});

console.log('[REPLIT-DEPLOY] Démarrage de l\'application en mode déploiement...');
console.log(`[REPLIT-DEPLOY] Environnement: ${NODE_ENV}`);
console.log(`[REPLIT-DEPLOY] Port: ${PORT}`);

// Initialiser l'application Express
const app = express();
app.use(express.json());

// Servir les fichiers statiques de la page d'accueil
app.use(express.static(path.join(__dirname, 'public')));

// Routes de l'API
app.use('/api', apiRoutes);

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Page de monitoring uptime
app.get('/uptime', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'uptime.html'));
});

// Endpoint de santé
app.get('/health', (req, res) => {
  const uptime = Math.floor(process.uptime());
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
  
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    environment: NODE_ENV,
    uptime: uptimeFormatted,
    timestamp: new Date().toISOString(),
    service: 'replit-deployment'
  });
});

// Démarrer le serveur Express
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[REPLIT-DEPLOY] Serveur web démarré sur port ${PORT}`);
  
  try {
    // Initialiser le client Hedera
    initClient();
    console.log('[REPLIT-DEPLOY] Client Hedera initialisé avec succès');
    
    // Démarrer le bot Telegram
    createBot();
    console.log('[REPLIT-DEPLOY] Bot Telegram démarré avec succès');
    
    console.log('[REPLIT-DEPLOY] Application Zenwa démarrée avec succès !');
  } catch (error) {
    console.error('[REPLIT-DEPLOY] Erreur lors de l\'initialisation de l\'application:', error);
  }
});
