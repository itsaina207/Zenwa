#!/bin/bash

# Script d'entrée pour le déploiement Replit
# Ce script garantit que le bot Telegram est lancé même si le déploiement standard échoue

echo "=== Démarrage du déploiement Zenwa ==="

# Vérifier que les variables d'environnement sont disponibles
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "AVERTISSEMENT: Variable TELEGRAM_BOT_TOKEN non définie"
fi

if [ -z "$HEDERA_AI_KIT_ACCOUNT_ID" ]; then
  echo "AVERTISSEMENT: Variables Hedera non définies"
fi

# Lancer le déploiement principal
echo "Lancement du script replit-deploy.js"
node replit-deploy.js &
DEPLOY_PID=$!

# Attendre un peu pour confirmer que le démarrage s'est bien passé
sleep 10

# Vérifier que le bot est en fonctionnement
if kill -0 $DEPLOY_PID 2>/dev/null; then
  echo "Déploiement principal actif avec PID $DEPLOY_PID"
else
  echo "Le déploiement principal a échoué, tentative de démarrage du bot uniquement"
  node src/index.js &
  BOT_PID=$!
  echo "Bot Telegram démarré avec PID $BOT_PID"
fi

# Garder le script actif pour éviter que Replit ne termine le déploiement
while true; do
  echo "[$(date)] Zenwa toujours actif"
  sleep 300
done
