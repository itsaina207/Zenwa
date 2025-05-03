/**
 * Point d'entrée unique pour le déploiement Replit Always-On
 * Ce fichier centralise le démarrage de tous les services nécessaires
 * pour garantir un fonctionnement 24/7
 */

// Modules requis
const express = require('express');
const path = require('path');
const { createBot } = require('./src/telegram/bot');
const { initClient } = require('./src/hedera/client');
const apiRoutes = require('./src/api');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// Configuration et variables d'environnement
dotenv.config({ path: '.env.deployment' });
const PORT = process.env.PORT || 8000;
const FLASK_PORT = 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let pingCount = 0;

// Gestion d'erreurs globale
process.on('uncaughtException', (error) => {
  console.error('[ZENWA-DEPLOY] UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ZENWA-DEPLOY] UNHANDLED REJECTION at Promise:', promise, 'reason:', reason);
});

// Affichage des informations de démarrage
console.log('='.repeat(60));
console.log('[ZENWA-DEPLOY] Démarrage de Zenwa en mode Always-On...');
console.log(`[ZENWA-DEPLOY] Environnement: ${NODE_ENV}`);
console.log(`[ZENWA-DEPLOY] Port principal: ${PORT}`);
console.log(`[ZENWA-DEPLOY] Port secondaire: ${FLASK_PORT}`);
console.log('='.repeat(60));

// Initialiser l'application Express
const app = express();
app.use(express.json());

// Routes statiques et API
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
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
    service: 'zenwa-deployment',
    telegram_bot: 'connected',
    hedera_client: 'initialized'
  });
});

// Fonction pour envoyer une requête HTTP/HTTPS
function sendRequest(url, isHttps = false) {
  return new Promise((resolve, reject) => {
    console.log(`[ZENWA-DEPLOY] Envoi d'une requête à ${url}`);
    const client = isHttps ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ success: true, status: res.statusCode, data });
        } else {
          resolve({ success: false, status: res.statusCode, data });
        }
      });
    });
    req.on('error', (err) => { reject(err); });
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Fonction pour effectuer un ping externe du service déployé
async function pingExternalService() {
  try {
    pingCount++;
    console.log(`[ZENWA-DEPLOY] Ping #${pingCount} à ${new Date().toISOString()}`);
    
    // Détection de l'URL de déploiement Replit
    let externalUrl = null;
    if (process.env.REPL_SLUG) {
      if (process.env.REPL_OWNER) {
        externalUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      } else {
        externalUrl = `https://${process.env.REPL_SLUG}.replit.app`;
      }
    }
    
    if (!externalUrl) {
      console.warn('[ZENWA-DEPLOY] Impossible de déterminer l\'URL externe');
      return;
    }
    
    // Ping de l'URL externe
    console.log(`[ZENWA-DEPLOY] URL externe détectée: ${externalUrl}`);
    const result = await sendRequest(`${externalUrl}/health`, true);
    console.log(`[ZENWA-DEPLOY] Ping externe réussi: ${result.success}`);
    
    // Vérification des services locaux
    const localHealth = await sendRequest(`http://localhost:${PORT}/health`, false);
    console.log(`[ZENWA-DEPLOY] Santé locale: ${localHealth.success}`);
  } catch (error) {
    console.error(`[ZENWA-DEPLOY] Erreur lors du ping: ${error.message}`);
  }
}

// Fonction pour démarrer le serveur Flask (Python)
function startFlaskServer() {
  return new Promise((resolve, reject) => {
    console.log('[ZENWA-DEPLOY] Démarrage du serveur Flask...');
    const flaskProcess = spawn('gunicorn', ['--bind', `0.0.0.0:${FLASK_PORT}`, '--reuse-port', '--reload', 'main:app'], {
      detached: true,
      stdio: 'inherit'
    });
    
    flaskProcess.on('error', (err) => {
      console.error('[ZENWA-DEPLOY] Erreur lors du démarrage du serveur Flask:', err);
      reject(err);
    });
    
    // Vérifier que le serveur Flask a bien démarré
    setTimeout(async () => {
      try {
        const result = await sendRequest(`http://localhost:${FLASK_PORT}/health`, false);
        if (result.success) {
          console.log('[ZENWA-DEPLOY] Serveur Flask démarré avec succès');
          resolve(true);
        } else {
          console.warn('[ZENWA-DEPLOY] Serveur Flask démarré mais répond avec une erreur');
          resolve(false);
        }
      } catch (error) {
        console.warn('[ZENWA-DEPLOY] Serveur Flask non disponible (attendu pour certaines configurations)');
        resolve(false);
      }
    }, 5000);
  });
}

// Fonction pour démarrer les processus de surveillance
function startMonitoringProcesses() {
  console.log('[ZENWA-DEPLOY] Démarrage des processus de surveillance...');
  
  // Démarrer le processus Always-On
  try {
    const alwaysOnProcess = spawn('node', ['always-on.js'], {
      detached: true,
      stdio: 'inherit'
    });
    alwaysOnProcess.on('error', (err) => {
      console.error('[ZENWA-DEPLOY] Erreur lors du démarrage du processus Always-On:', err);
    });
    console.log('[ZENWA-DEPLOY] Processus Always-On démarré');
  } catch (error) {
    console.error('[ZENWA-DEPLOY] Impossible de démarrer le processus Always-On:', error);
  }
  
  // Démarrer le processus Worker
  try {
    const workerProcess = spawn('node', ['worker.js'], {
      detached: true,
      stdio: 'inherit'
    });
    workerProcess.on('error', (err) => {
      console.error('[ZENWA-DEPLOY] Erreur lors du démarrage du processus Worker:', err);
    });
    console.log('[ZENWA-DEPLOY] Processus Worker démarré');
  } catch (error) {
    console.error('[ZENWA-DEPLOY] Impossible de démarrer le processus Worker:', error);
  }
  
  // Initialiser le ping périodique
  console.log(`[ZENWA-DEPLOY] Configuration du ping toutes les ${PING_INTERVAL/60000} minutes`);
  setInterval(pingExternalService, PING_INTERVAL);
  setTimeout(pingExternalService, 30000); // Premier ping après 30 secondes
}

// Démarrer le serveur Express et initialiser les composants
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[ZENWA-DEPLOY] Serveur démarré sur le port ${PORT}`);
  
  try {
    // Démarrer le serveur Flask en arrière-plan
    await startFlaskServer();
    
    // Initialiser le client Hedera
    initClient();
    console.log('[ZENWA-DEPLOY] Client Hedera initialisé avec succès');
    
    // Démarrer le bot Telegram avec gestion d'erreur robuste
    try {
      createBot();
      console.log('[ZENWA-DEPLOY] Bot Telegram démarré avec succès');
    } catch (error) {
      console.error('[ZENWA-DEPLOY] Erreur lors du démarrage du bot Telegram:', error);
      console.log('[ZENWA-DEPLOY] Tentative de redémarrage du bot après 10 secondes...');
      
      // Tentative de redémarrage après 10 secondes
      setTimeout(() => {
        try {
          createBot();
          console.log('[ZENWA-DEPLOY] Bot Telegram redémarré avec succès');
        } catch (retryError) {
          console.error('[ZENWA-DEPLOY] Échec du redémarrage du bot:', retryError);
          console.log('[ZENWA-DEPLOY] Vérifiez les variables d\'environnement et les connexions réseau');
        }
      }, 10000);
    }
    
    // Démarrer les processus de surveillance
    startMonitoringProcesses();
    
    // Confirmer le démarrage complet
    console.log('='.repeat(60));
    console.log('[ZENWA-DEPLOY] Zenwa est maintenant actif en mode Always-On');
    console.log('[ZENWA-DEPLOY] Le bot Telegram fonctionne 24/7');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('[ZENWA-DEPLOY] Erreur lors de l\'initialisation de Zenwa:', error);
  }
});
