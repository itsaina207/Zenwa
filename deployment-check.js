/**
 * Script de vérification de déploiement
 * Aide à diagnostiquer les problèmes lors du déploiement sur Replit
 */

console.log('='.repeat(50));
console.log('Début de la vérification de déploiement');
console.log('='.repeat(50));

// Vérifier les variables d'environnement
console.log('\nVARIABLES D\'ENVIRONNEMENT:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('REPLIT_DB_URL exists:', !!process.env.REPLIT_DB_URL);
console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('ZENWA_TELEGRAM exists:', !!process.env.ZENWA_TELEGRAM);
console.log('HEDERA_AI_KIT_ACCOUNT_ID exists:', !!process.env.HEDERA_AI_KIT_ACCOUNT_ID);
console.log('HEDERA_AI_KIT_PRIVATE_KEY exists:', !!process.env.HEDERA_AI_KIT_PRIVATE_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

// Vérifier la version de Node.js
console.log('\nINFORMATIONS SYSTÈME:');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('PID:', process.pid);

// Vérifier l'accès aux fichiers
const fs = require('fs');
const path = require('path');

console.log('\nVÉRIFICATION DES FICHIERS:');

function checkFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✓ ${filePath} - ${stats.size} bytes`);
      return true;
    } else {
      console.log(`✗ ${filePath} - MISSING`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${filePath} - ERROR: ${error.message}`);
    return false;
  }
}

checkFile('replit.js');
checkFile('Procfile');
checkFile('src/index.js');
checkFile('src/config.js');
checkFile('src/telegram/bot.js');
checkFile('src/hedera/client.js');
checkFile('public/index.html');
checkFile('.env.deployment');

// Vérifier l'accès à la base de données PostgreSQL
console.log('\nVÉRIFICATION DE LA BASE DE DONNÉES:');
let pgConnected = false;

try {
  const { Pool } = require('pg');
  
  if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL est défini');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.log(`✗ Connection à PostgreSQL échouée: ${err.message}`);
      } else {
        console.log(`✓ Connecté à PostgreSQL: ${res.rows[0].now}`);
        pgConnected = true;
      }
      
      console.log('\nFIN DE LA VÉRIFICATION');
      console.log('='.repeat(50));
    });
  } else {
    console.log('✗ DATABASE_URL n\'est pas défini');
    console.log('\nFIN DE LA VÉRIFICATION');
    console.log('='.repeat(50));
  }
} catch (error) {
  console.log(`✗ Erreur lors de la vérification de PostgreSQL: ${error.message}`);
  console.log('\nFIN DE LA VÉRIFICATION');
  console.log('='.repeat(50));
}
