#!/bin/bash

# Charger les variables d'environnement pour le déploiement
if [ -f ".env.deployment" ]; then
  echo "Chargement des variables d'environnement de déploiement..."
  export $(grep -v '^#' .env.deployment | xargs)
  echo "Variables d'environnement chargées avec succès."
fi

# Vérifier que les variables essentielles sont définies
if [ -z "$TELEGRAM_BOT_TOKEN" ] && [ -z "$ZENWA_TELEGRAM" ]; then
  echo "ERREUR: Ni TELEGRAM_BOT_TOKEN ni ZENWA_TELEGRAM ne sont définis. Le bot ne pourra pas fonctionner."
  exit 1
fi

if [ -z "$HEDERA_AI_KIT_ACCOUNT_ID" ] || [ -z "$HEDERA_AI_KIT_PRIVATE_KEY" ]; then
  echo "ERREUR: Les informations de compte Hedera ne sont pas configurées correctement."
  exit 1
fi

# Démarrer l'application Flask en arrière-plan
echo "Démarrage du serveur web Flask..."
gunicorn --bind 0.0.0.0:5000 main:app &
echo "Serveur web démarré sur le port 5000."

# Démarrer le bot Telegram (Node.js)
echo "Démarrage du bot Zenwa..."
cd src && NODE_ENV=production node index.js
