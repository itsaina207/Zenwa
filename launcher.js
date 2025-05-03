/**
 * Script de lancement pour le déploiement Replit
 * Ce fichier sert de pont entre le workflow et le script replit-deploy.js
 */

console.log('='.repeat(60));
console.log('Démarrage du script de lancement pour Zenwa...');
console.log('='.repeat(60));

// Charger le script de déploiement centralisé
try {
  console.log('Chargement du script replit-deploy.js...');
  require('./replit-deploy.js');
  console.log('Script de déploiement lancé avec succès');
} catch (error) {
  console.error('Erreur lors du chargement de replit-deploy.js:', error);
  
  // En cas d'échec, tenter de lancer le bot Telegram directement
  console.log('Tentative de lancement du bot Telegram via src/index.js...');
  try {
    require('./src/index.js');
    console.log('Bot Telegram lancé avec succès via src/index.js');
  } catch (innerError) {
    console.error('Impossible de lancer le bot Telegram:', innerError);
    process.exit(1);
  }
}

// Garder le processus actif
setInterval(() => {
  console.log(`[LAUNCHER] Zenwa fonctionne depuis ${Math.floor(process.uptime())} secondes`);
}, 60000); // Log toutes les minutes
