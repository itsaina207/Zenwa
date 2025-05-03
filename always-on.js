/**
 * Script Always-On pour Zenwa
 * Permet de maintenir l'application active 24/7 sur Replit
 */

const http = require('http');
const https = require('https');

// Configuration
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const LOCAL_PORT = 5000; // Port principal de l'application Flask
const SECONDARY_PORT = 8000; // Port du serveur API Node.js
let pingCount = 0;

// Fonction pour envoyer une requête HTTP/HTTPS
function sendRequest(url, isHttps = false) {
  return new Promise((resolve, reject) => {
    console.log(`[ALWAYS-ON] Envoi d'une requête à ${url}`);
    
    const client = isHttps ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(`[ALWAYS-ON] Requête réussie: ${url} (${res.statusCode})`);
          resolve({ success: true, status: res.statusCode, data });
        } else {
          console.log(`[ALWAYS-ON] Requête échouée: ${url} (${res.statusCode})`);
          resolve({ success: false, status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`[ALWAYS-ON] Erreur de requête: ${url}`, err.message);
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.error(`[ALWAYS-ON] Timeout de la requête: ${url}`);
      reject(new Error('Request timeout'));
    });
  });
}

// Fonction pour vérifier l'état de santé du serveur Flask
async function checkFlaskHealth() {
  try {
    const result = await sendRequest(`http://localhost:${LOCAL_PORT}/health`);
    return result.success;
  } catch (error) {
    console.error('[ALWAYS-ON] Échec de la vérification Flask:', error.message);
    return false;
  }
}

// Fonction pour vérifier l'état de santé du serveur API Node.js
async function checkNodeHealth() {
  try {
    const result = await sendRequest(`http://localhost:${SECONDARY_PORT}/health`);
    return result.success;
  } catch (error) {
    console.error('[ALWAYS-ON] Échec de la vérification Node:', error.message);
    return false;
  }
}

// Fonction pour effectuer un ping externe
async function performExternalPing() {
  try {
    // Construire l'URL du déploiement Replit
    let externalUrl = null;
    
    if (process.env.REPL_SLUG) {
      if (process.env.REPL_OWNER) {
        externalUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      } else {
        externalUrl = `https://${process.env.REPL_SLUG}.replit.app`;
      }
    }
    
    if (!externalUrl) {
      console.warn('[ALWAYS-ON] Impossible de déterminer l\'URL externe');
      return false;
    }
    
    console.log(`[ALWAYS-ON] URL externe détectée: ${externalUrl}`);
    
    // Ping l'URL externe
    const result = await sendRequest(`${externalUrl}/health`, true);
    return result.success;
  } catch (error) {
    console.error('[ALWAYS-ON] Échec du ping externe:', error.message);
    return false;
  }
}

// Fonction principale de ping
async function performPing() {
  pingCount++;
  console.log(`\n[ALWAYS-ON] Exécution du ping #${pingCount} à ${new Date().toISOString()}`);
  
  // Vérifier l'état de santé des deux serveurs
  const flaskOk = await checkFlaskHealth();
  const nodeOk = await checkNodeHealth();
  
  console.log(`[ALWAYS-ON] État Flask: ${flaskOk ? 'OK' : 'ERREUR'}, Node: ${nodeOk ? 'OK' : 'ERREUR'}`);
  
  // Tenter un ping externe si au moins un des serveurs est en ligne
  if (flaskOk || nodeOk) {
    const externalOk = await performExternalPing();
    console.log(`[ALWAYS-ON] Ping externe: ${externalOk ? 'RÉUSSI' : 'ÉCHOUÉ'}`);
  }
  
  // Planifier le prochain ping
  setTimeout(performPing, PING_INTERVAL);
}

// Démarrer le système de ping
console.log('[ALWAYS-ON] Démarrage du système Always-On pour Zenwa');
console.log(`[ALWAYS-ON] Intervalle de ping: ${PING_INTERVAL / 60000} minutes`);
console.log(`[ALWAYS-ON] Ports surveillés: Flask (${LOCAL_PORT}), Node.js (${SECONDARY_PORT})`);

// Premier ping après 10 secondes
setTimeout(performPing, 10000);

// Créer un petit serveur HTTP pour maintenir le processus en vie
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'always-on',
    pingCount,
    timestamp: new Date().toISOString()
  }));
});

server.listen(9999, '0.0.0.0', () => {
  console.log('[ALWAYS-ON] Serveur de surveillance démarré sur le port 9999');
});
