#!/bin/bash

# Script de déploiement spécifique pour Replit Deployments
echo "===================================================="
echo "= Préparation du déploiement de Zenwa sur Replit ="
echo "===================================================="

# Vérifier si nous sommes dans un environnement de déploiement Replit
if [ -n "$REPL_ID" ] || [ -n "$REPL_SLUG" ] || [ -n "$REPLIT_DB_URL" ]; then
  echo "✓ Environnement Replit détecté"
  # Afficher des informations sur l'environnement
  echo "REPL_ID: $REPL_ID"
  echo "REPL_SLUG: $REPL_SLUG"
  echo "PORT: $PORT"
  echo "NODE_ENV: $NODE_ENV"
  
  # Si nous sommes dans un déploiement Replit, charger les variables d'environnement
  if [ -f ".env.deployment" ]; then
    echo "✓ Chargement des variables de déploiement depuis .env.deployment"
    set -a
    source .env.deployment
    set +a
  else
    echo "⚠ .env.deployment non trouvé, utilisation des variables de l'environnement Replit"
  fi
else
  echo "⚠ Environnement Replit non détecté, déploiement en mode standard"
fi

# Exécuter le script principal de démarrage
echo "===================================================="
echo "= Démarrage de l'application... ="
echo "===================================================="
bash run.sh
