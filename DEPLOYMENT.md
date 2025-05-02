# Guide de déploiement de Zenwa

## Prérequis pour le déploiement

Avant de déployer Zenwa, assurez-vous que les variables d'environnement suivantes sont correctement configurées dans votre application Replit :

- `TELEGRAM_BOT_TOKEN` ou `ZENWA_TELEGRAM` : Votre token d'accès pour le bot Telegram
- `HEDERA_AI_KIT_ACCOUNT_ID` : L'ID de compte Hedera pour le Kit AI
- `HEDERA_AI_KIT_PRIVATE_KEY` : La clé privée de compte Hedera
- `HEDERA_AI_KIT_PUBLIC_KEY` : La clé publique de compte Hedera
- `HEDERA_AI_KIT_EVM_ADDRESS` : L'adresse EVM associée
- `OPENAI_API_KEY` : La clé API pour OpenAI

## Étapes de déploiement

1. **Vérifiez votre Procfile**
   
   Assurez-vous que votre fichier `Procfile` contient:
   ```
   web: bash run.sh
   ```
   
   Ce script exécutera `run.sh`, qui affichera des informations sur l'environnement avant de lancer le script principal `start.sh`.

2. **Configurez les scripts de démarrage**
   
   Le fichier `start.sh` doit être exécutable et contenir:
   ```bash
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

   # Démarrer l'application Flask en arrière-plan
   echo "Démarrage du serveur web Flask..."
   gunicorn --bind 0.0.0.0:5000 main:app &
   echo "Serveur web démarré sur le port 5000."

   # Démarrer le bot Telegram (Node.js)
   echo "Démarrage du bot Zenwa..."
   cd src && NODE_ENV=production node index.js
   ```
   
   Le fichier `run.sh` doit également être exécutable et contenir:
   ```bash
   #!/bin/bash

   # Afficher les informations sur l'environnement
   echo "=== Configuration de l'environnement Zenwa ==="
   echo "NODE_ENV: $NODE_ENV"
   echo "REPLIT_DEPLOYMENT: $REPLIT_DB_URL"
   echo "=== Fin de la configuration ==="

   # Exécuter le script principal d'exécution
   bash start.sh
   ```

3. **Environnement de déploiement**
   
   Utilisez le fichier `.env.deployment` comme modèle pour configurer vos variables d'environnement.

4. **Déploiement sur Replit**
   
   1. Cliquez sur le bouton "Deploy" dans votre interface Replit
   2. Choisissez "Deploy from Git" si vous avez pushé votre code sur GitHub
   3. Configurez les variables d'environnement nécessaires
   4. Lancez le déploiement

## Vérification du déploiement

Après le déploiement, vérifiez que tout fonctionne :

1. Visitez la page d'accueil : `https://votre-app.replit.app/`
2. Vérifiez l'état du serveur : `https://votre-app.replit.app/health`
3. Consultez le tableau de bord uptime : `https://votre-app.replit.app/uptime`
4. Testez votre bot Telegram en lui envoyant la commande `/start`

## Surveillance de l'application

Zenwa intègre un système de surveillance 24/7 composé de :

1. **Auto-ping interne** qui vérifie régulièrement l'état du serveur
2. **Surveillance client** depuis la page d'accueil
3. **Endpoints de monitoring** pour intégration avec UptimeRobot
4. **Rapports de performance** générés automatiquement

Consultez `UPTIME.md` pour plus de détails sur le système de surveillance.

## Dépannage

Si le bot ne fonctionne pas après le déploiement :

1. Vérifiez les logs de Replit pour identifier les erreurs
2. Assurez-vous que toutes les variables d'environnement sont correctement définies
3. Vérifiez que le script `start.sh` s'exécute sans erreur
4. Consultez l'endpoint `/health` pour vérifier l'état des différents composants
5. Redéployez l'application après avoir corrigé les problèmes identifiés