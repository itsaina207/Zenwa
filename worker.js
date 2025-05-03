/**
 * Worker de fond pour maintenir le bot actif 24/7
 * Ce fichier est utilisé comme un service supplémentaire qui s'assure que le bot reste actif
 */

const http = require('http');
const https = require('https');

// Configuration
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const SERVICE_PORTS = [5000, 8000]; // Ports à surveiller

// Détection de l'URL de déploiement
function getDeploymentUrl() {
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  } else if (process.env.REPL_SLUG) {
    return `https://${process.env.REPL_SLUG}.replit.app`;
  }
  return null;
}

// Vérification des services
async function checkService(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`[WORKER] Service sur port ${port} est actif`);
          resolve(true);
        } else {
          console.warn(`[WORKER] Service sur port ${port} a répondu avec code ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`[WORKER] Service sur port ${port} est inactif: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.error(`[WORKER] Timeout lors de la vérification du service sur port ${port}`);
      resolve(false);
    });
  });
}

// Vérification de l'URL de déploiement
async function pingDeployment() {
  const url = getDeploymentUrl();
  if (!url) {
    console.warn('[WORKER] Impossible de déterminer l\'URL de déploiement');
    return false;
  }
  
  return new Promise((resolve) => {
    const req = https.get(`${url}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`[WORKER] Déploiement ${url} est actif`);
          resolve(true);
        } else {
          console.warn(`[WORKER] Déploiement ${url} a répondu avec code ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`[WORKER] Déploiement ${url} est inactif: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.error(`[WORKER] Timeout lors de la vérification du déploiement ${url}`);
      resolve(false);
    });
  });
}

// Fonction principale de vérification
async function runCheck() {
  console.log('\n[WORKER] Exécution de la vérification de l\'activité ' + new Date().toISOString());
  
  // Vérifier les services locaux
  let serviceStatus = false;
  for (const port of SERVICE_PORTS) {
    const status = await checkService(port);
    if (status) serviceStatus = true;
  }
  
  // Vérifier le déploiement
  const deploymentStatus = await pingDeployment();
  
  // Rapport global
  if (serviceStatus && deploymentStatus) {
    console.log('[WORKER] Tous les services fonctionnent correctement');
  } else if (serviceStatus) {
    console.warn('[WORKER] Services locaux actifs mais déploiement inactif');
  } else if (deploymentStatus) {
    console.warn('[WORKER] Déploiement actif mais services locaux inactifs');
  } else {
    console.error('[WORKER] AUCUN SERVICE N\'EST ACTIF !');
  }
}

// Démarrage du worker
console.log('[WORKER] Démarrage du worker pour maintenir le bot Zenwa actif 24/7');
console.log(`[WORKER] Vérification toutes les ${CHECK_INTERVAL/60000} minutes`);

// Petite pause avant la première vérification
setTimeout(() => {
  runCheck();
  
  // Planifier les vérifications périodiques
  setInterval(runCheck, CHECK_INTERVAL);
}, 15000);

// Créer un petit serveur HTTP pour maintenir le processus en vie
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'zenwa-worker',
    timestamp: new Date().toISOString()
  }));
});

server.listen(9998, '0.0.0.0', () => {
  console.log('[WORKER] Serveur de gestion démarré sur le port 9998');
});
