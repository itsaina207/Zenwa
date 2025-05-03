/**
 * Script de redémarrage périodique pour Zenwa
 * Ce script est destiné à être exécuté via un cron job Replit
 * Il assure un redémarrage propre des services à intervalles réguliers
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const LOG_FILE = path.join(__dirname, 'cron-reboot.log');
const LOCK_FILE = path.join(__dirname, '.cron-reboot.lock');
const SERVICE_TIMEOUT = 30 * 60 * 1000; // 30 minutes maximum sans reboot

// Fonctions utilitaires
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Vérifier si un redmarrage est en cours
function isRestartInProgress() {
  if (fs.existsSync(LOCK_FILE)) {
    const lockData = fs.readFileSync(LOCK_FILE, 'utf8');
    const lockTime = new Date(lockData);
    const now = new Date();
    const diffMinutes = (now - lockTime) / 1000 / 60;
    
    if (diffMinutes < 10) { // lock expires after 10 minutes
      log(`Un redémarrage est déjà en cours (${Math.round(diffMinutes)} minutes)`);
      return true;
    } else {
      log('Verrou expiré, reprise du redémarrage');
      return false;
    }
  }
  
  return false;
}

// Créer un verrou de redémarrage
function createRestartLock() {
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  log('Verrou de redémarrage créé');
}

// Libérer le verrou de redémarrage
function releaseRestartLock() {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
    log('Verrou de redémarrage supprimé');
  }
}

// Vérifier l'état du service
async function checkServiceHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8000/health', (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const healthData = JSON.parse(data);
            const uptime = healthData.uptime || '0h 0m 0s';
            log(`Service en ligne, uptime: ${uptime}`);
            
            // Vérifier si le service est actif depuis trop longtemps
            const uptimeMatches = uptime.match(/(\d+)h\s+(\d+)m/);
            if (uptimeMatches) {
              const hours = parseInt(uptimeMatches[1]);
              const minutes = parseInt(uptimeMatches[2]);
              const uptimeMinutes = hours * 60 + minutes;
              
              if (uptimeMinutes > SERVICE_TIMEOUT / 60000) {
                log(`Service actif depuis trop longtemps (${uptimeMinutes} minutes)`);
                resolve('reboot_needed');
                return;
              }
            }
            
            resolve('healthy');
          } catch (e) {
            log(`Erreur lors de l'analyse de la réponse: ${e.message}`);
            resolve('unhealthy');
          }
        });
      } else {
        log(`Service répond avec code d'erreur: ${res.statusCode}`);
        resolve('unhealthy');
      }
    });
    
    req.on('error', (err) => {
      log(`Service injoignable: ${err.message}`);
      resolve('unreachable');
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      log('Timeout lors de la vérification du service');
      resolve('timeout');
    });
  });
}

// Redémarrer les services
async function restartServices() {
  if (isRestartInProgress()) {
    return;
  }
  
  try {
    createRestartLock();
    log('Début de la procédure de redémarrage');
    
    // Arrêt des processus
    log('Arrêt des processus en cours...');
    execSync('pkill -f "node replit-deploy\.js" || true');
    execSync('pkill -f "node always-on\.js" || true');
    execSync('pkill -f "node worker\.js" || true');
    execSync('pkill -f "gunicorn" || true');
    
    // Attendre l'arrêt complet
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Redémarrage du service principal
    log('Redémarrage du service principal...');
    const proc = spawn('node', ['replit-deploy.js'], {
      detached: true,
      stdio: ['ignore', fs.openSync('zenwa-deploy.log', 'a'), fs.openSync('zenwa-deploy-error.log', 'a')]
    });
    proc.unref();
    
    // Attendre le démarrage du service
    log('Attente du démarrage du service...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Vérifier que le service est bien démarré
    const status = await checkServiceHealth();
    if (status === 'healthy') {
      log('Redémarrage réussi, service en ligne');
    } else {
      log(`Redémarrage terminé mais service dans l'état: ${status}`);
    }
  } catch (error) {
    log(`Erreur lors du redémarrage: ${error.message}`);
  } finally {
    releaseRestartLock();
  }
}

// Fonction principale
async function main() {
  log('='.repeat(50));
  log('Démarrage du script cron-reboot');
  
  // Vérifier l'état du service
  const status = await checkServiceHealth();
  log(`État du service: ${status}`);
  
  // Décider si un redémarrage est nécessaire
  if (status === 'healthy') {
    log('Le service fonctionne correctement, pas de redémarrage nécessaire');
  } else {
    log(`Redémarrage nécessaire en raison de l'état: ${status}`);
    await restartServices();
  }
  
  log('Script cron-reboot terminé');
  log('='.repeat(50));
}

// Exécuter le script
main().catch(error => {
  log(`Erreur fatale: ${error.message}`);
});
