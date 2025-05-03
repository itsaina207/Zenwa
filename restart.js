/**
 * Script de redémarrage pour le déploiement Replit
 * Ce script permet de redémarrer l'application complète en cas de problème
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Créer un fichier de verrouillage pour éviter les redémarrages simultanés
const lockFile = path.join(__dirname, '.restart-lock');

if (fs.existsSync(lockFile)) {
  const stats = fs.statSync(lockFile);
  const fileTime = new Date(stats.mtime);
  const currentTime = new Date();
  const timeDiff = (currentTime - fileTime) / 1000 / 60; // en minutes
  
  if (timeDiff < 5) {
    console.log(`[RESTART] Un redémarrage a été effectué il y a moins de 5 minutes (${Math.round(timeDiff)} minutes)`);
    console.log('[RESTART] Annulation du redémarrage pour éviter un cycle infini');
    process.exit(0);
  }
}

// Créer ou mettre à jour le fichier de verrouillage
fs.writeFileSync(lockFile, new Date().toISOString());

console.log('='.repeat(60));
console.log('[RESTART] Démarrage de la procédure de redémarrage complet...');

// Vérifier l'état des services
async function checkServices() {
  return new Promise((resolve) => {
    console.log('[RESTART] Vérification des services en cours...');
    
    // Vérifier le service principal (port 8000)
    const req = http.get('http://localhost:8000/health', (res) => {
      if (res.statusCode === 200) {
        console.log('[RESTART] Service principal fonctionnel');
        resolve(true);
      } else {
        console.log(`[RESTART] Service principal en état dégradé (${res.statusCode})`);
        resolve(false);
      }
    });
    
    req.on('error', () => {
      console.log('[RESTART] Service principal inaccessible, redémarrage nécessaire');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('[RESTART] Timeout lors de la vérification, redémarrage nécessaire');
      resolve(false);
    });
  });
}

// Exécuter une commande système avec promesse
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[RESTART] Erreur lors de l'exécution de la commande: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.warn(`[RESTART] Avertissements: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

// Procédure principale de redémarrage
async function performRestart() {
  try {
    // Vérifier d'abord si les services sont accessibles
    const servicesOk = await checkServices();
    
    if (servicesOk) {
      console.log('[RESTART] Les services semblent fonctionner correctement');
      console.log('[RESTART] Exécution d’un redémarrage préventif...');
    } else {
      console.log('[RESTART] Problèmes détectés avec les services, redémarrage nécessaire');
    }
    
    // Arrêter les processus Node.js
    console.log('[RESTART] Arrêt des processus Node.js existants...');
    await execCommand('pkill -f "node replit-deploy\.js" || true');
    await execCommand('pkill -f "node always-on\.js" || true');
    await execCommand('pkill -f "node worker\.js" || true');
    
    // Arrêter les processus Python
    console.log('[RESTART] Arrêt des processus Python existants...');
    await execCommand('pkill -f "gunicorn" || true');
    
    // Attendre un peu pour que tout s'arrête proprement
    console.log('[RESTART] Attente de l’arrêt complet des processus...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Redémarrer l'application principale
    console.log('[RESTART] Démarrage de l’application principale...');
    const proc = exec('node replit-deploy.js > zenwa-deploy.log 2>&1 &');
    proc.unref();
    
    console.log('[RESTART] Redémarrage complet effectué avec succès!');
    console.log('[RESTART] Les services devraient être disponibles dans quelques secondes');
    console.log('='.repeat(60));
  } catch (error) {
    console.error(`[RESTART] Erreur lors du redémarrage: ${error.message}`);
  }
}

// Exécuter la procédure de redémarrage
performRestart();
