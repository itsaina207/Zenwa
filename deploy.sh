#!/bin/bash

# Script d'entrée pour le déploiement Replit
# Ce script garantit que le bot Telegram est lancé même si le déploiement standard échoue

echo "=== Démarrage du déploiement Zenwa ==="
echo "$(date) - Début du processus de déploiement"

# Vérifier que les variables d'environnement sont disponibles
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "AVERTISSEMENT: Variable TELEGRAM_BOT_TOKEN non définie"
fi

if [ -z "$HEDERA_AI_KIT_ACCOUNT_ID" ]; then
  echo "AVERTISSEMENT: Variables Hedera non définies"
fi

# Démarrer le script Flask en arrière-plan
echo "Démarrage du serveur Flask sur le port 5000..."
gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app > flask.log 2>&1 &
FLASK_PID=$!
echo "Serveur Flask démarré avec PID $FLASK_PID"

# Attendre que Flask démarre
sleep 5

# Lancer le déploiement principal
echo "Lancement du script replit-deploy.js pour le bot Telegram"
node replit-deploy.js > zenwa-deploy.log 2>&1 &
DEPLOY_PID=$!

# Attendre un peu pour confirmer que le démarrage s'est bien passé
sleep 15

# Vérifier que le bot est en fonctionnement
if kill -0 $DEPLOY_PID 2>/dev/null; then
  echo "Déploiement principal actif avec PID $DEPLOY_PID"
  
  # Vérifier les logs pour confirmer que tout est bien initialisé
  if grep -q "Hedera client initialized for testnet" zenwa-deploy.log && \
     grep -q "Telegram bot started successfully" zenwa-deploy.log && \
     grep -q "Server running on port 8000" zenwa-deploy.log; then
    echo "SUCCÈS: Bot Telegram et client Hedera correctement initialisés"
  else
    echo "AVERTISSEMENT: Certains composants pourraient ne pas être correctement initialisés"
    echo "Démarrage du bot en mode de secours..."
    cd src && node index.js > ../zenwa-bot.log 2>&1 &
    BACKUP_BOT_PID=$!
    echo "Bot de secours démarré avec PID $BACKUP_BOT_PID"
  fi
else
  echo "Le déploiement principal a échoué, tentative de démarrage du bot uniquement"
  cd src && node index.js > ../zenwa-bot.log 2>&1 &
  BOT_PID=$!
  echo "Bot Telegram démarré avec PID $BOT_PID"
fi

# Démarrer le système always-on dans un processus séparé
echo "Démarrage du système Always-On..."
node always-on.js > always-on.log 2>&1 &
ALWAYS_ON_PID=$!
echo "Système Always-On démarré avec PID $ALWAYS_ON_PID"

# Démarrer le processus worker
echo "Démarrage du processus worker..."
node worker.js > worker.log 2>&1 &
WORKER_PID=$!
echo "Processus worker démarré avec PID $WORKER_PID"

# Afficher un récapitulatif des processus lancés
echo ""
echo "=== Processus Zenwa actifs ==="
echo "Flask: PID $FLASK_PID"
echo "Bot Telegram/replit-deploy: PID $DEPLOY_PID"
echo "Always-On: PID $ALWAYS_ON_PID"
echo "Worker: PID $WORKER_PID"
if [ ! -z "$BOT_PID" ]; then
  echo "Bot de secours: PID $BOT_PID"
fi
if [ ! -z "$BACKUP_BOT_PID" ]; then
  echo "Bot de secours secondaire: PID $BACKUP_BOT_PID"
fi
echo "============================"

# Garder le script actif avec une vérification de santé périodique
while true; do
  echo "[$(date)] Zenwa toujours actif - Vérification de santé"
  
  # Vérifier si les services principaux fonctionnent toujours
  BOT_RUNNING=0
  if kill -0 $DEPLOY_PID 2>/dev/null || \
     ([ ! -z "$BOT_PID" ] && kill -0 $BOT_PID 2>/dev/null) || \
     ([ ! -z "$BACKUP_BOT_PID" ] && kill -0 $BACKUP_BOT_PID 2>/dev/null); then
    BOT_RUNNING=1
  fi
  
  # Relancer le bot s'il est arrêté
  if [ $BOT_RUNNING -eq 0 ]; then
    echo "Détection d'un arrêt du bot Telegram, redémarrage..."
    cd src && node index.js > ../zenwa-bot-recovery.log 2>&1 &
    RECOVERY_BOT_PID=$!
    echo "Bot récupéré avec PID $RECOVERY_BOT_PID"
  fi
  
  # Attendre jusqu'au prochain contrôle
  sleep 300
done
