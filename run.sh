#!/bin/bash

# Afficher les informations sur le déploiement
echo "======================================================"
echo "=== Configuration du déploiement Zenwa Replit ==="
echo "======================================================"
echo "Date de démarrage: $(date)"
echo "Hostname: $(hostname)"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "REPLIT_DB_URL: $REPLIT_DB_URL"

# Vérification des fichiers critiques
echo "======================================================"
echo "=== Vérification des fichiers critiques ==="
echo "======================================================"

if [ -f "main.py" ]; then
  echo "✓ main.py est présent"
else
  echo "✗ main.py est manquant!"
fi

if [ -f "start.sh" ]; then
  echo "✓ start.sh est présent"
else
  echo "✗ start.sh est manquant!"
fi

if [ -f "src/index.js" ]; then
  echo "✓ src/index.js est présent"
else
  echo "✗ src/index.js est manquant!"
fi

if [ -f ".env.deployment" ]; then
  echo "✓ .env.deployment est présent"
else
  echo "⚠ .env.deployment est manquant, mais les variables d'environnement peuvent être définies directement sur Replit"
fi

# Vérification des variables d'environnement critiques
echo "======================================================"
echo "=== Vérification des variables d'environnement ==="
echo "======================================================"

if [ -n "$TELEGRAM_BOT_TOKEN" ] || [ -n "$ZENWA_TELEGRAM" ]; then
  echo "✓ Token Telegram configuré"
else
  echo "✗ Token Telegram manquant!"
fi

if [ -n "$HEDERA_AI_KIT_ACCOUNT_ID" ] && [ -n "$HEDERA_AI_KIT_PRIVATE_KEY" ]; then
  echo "✓ Compte Hedera configuré"
else
  echo "✗ Configuration du compte Hedera incomplète!"
fi

if [ -n "$OPENAI_API_KEY" ]; then
  echo "✓ Clé API OpenAI configurée"
else
  echo "✗ Clé API OpenAI manquante!"
fi

if [ -n "$DATABASE_URL" ] || ([ -n "$PGHOST" ] && [ -n "$PGUSER" ] && [ -n "$PGPASSWORD" ] && [ -n "$PGDATABASE" ]); then
  echo "✓ Base de données PostgreSQL configurée"
else
  echo "⚠ Configuration PostgreSQL potentiellement incomplète"
fi

echo "======================================================"
echo "=== Démarrage de l'application ==="
echo "======================================================"

# Exécuter le script principal
bash start.sh
