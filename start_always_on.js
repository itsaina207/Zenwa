/**
 * Point d'entrée dédié pour le système Always-On
 * À exécuter via un workflow séparé
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('[ALWAYS-ON] Démarrage du système Always-On pour Zenwa');

// Démarrer le script Always-On dans un processus séparé
const alwaysOnProcess = spawn('node', ['always_on_script.js'], {
  detached: true,
  stdio: 'inherit'
});

alwaysOnProcess.on('error', (err) => {
  console.error('[ALWAYS-ON] Erreur lors du démarrage du système Always-On:', err);
  process.exit(1);
});

alwaysOnProcess.on('exit', (code) => {
  console.log(`[ALWAYS-ON] Le processus s'est terminé avec le code: ${code}`);
  process.exit(code);
});

console.log('[ALWAYS-ON] Processus de surveillance démarré avec succès');
