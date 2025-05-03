#!/bin/bash

# Script pour démarrer le système Always-On de Zenwa
# Ce script est conçu pour être exécuté via un cron job ou manuellement

echo "===========================================" 
echo "Démarrage du système Always-On pour Zenwa"
echo "===========================================" 

# Chemin vers le répertoire de l'application
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR" || exit 1

# Vérifier que le script exists
if [ ! -f "replit-deploy.js" ]; then
  echo "ERREUR: Le fichier replit-deploy.js n'existe pas"
  exit 1
 fi

# Vérifier si le processus est déjà en cours d'exécution
if pgrep -f "node replit-deploy\.js" > /dev/null; then
  echo "Le service Zenwa est déjà en cours d'exécution"
  echo "Utilisation de la RAM:"
  free -m
  echo "Liste des processus Node.js:"
  ps aux | grep node
  echo "Aucune action nécessaire"
  exit 0
fi

# Démarrer le script principal
echo "Démarrage de l'application Zenwa..."
nohup node replit-deploy.js > zenwa-deploy.log 2>&1 &
PID=$!

echo "Application démarrée avec PID: $PID"
echo "Vérification du démarrage dans 5 secondes..."

# Attendre un peu
sleep 5

# Vérifier que le processus est toujours en cours d'exécution
if kill -0 $PID 2>/dev/null; then
  echo "Le service a démarré avec succès et fonctionne avec PID: $PID"
  echo "Logs disponibles dans: $APP_DIR/zenwa-deploy.log"
  echo "===========================================" 
  exit 0
else
  echo "ERREUR: Le service n'a pas pu démarrer correctement"
  echo "Vérifiez les logs pour plus d'informations:"
  tail -n 20 zenwa-deploy.log
  echo "===========================================" 
  exit 1
fi
