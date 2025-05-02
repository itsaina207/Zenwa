# Guide de déploiement de Zenwa

## Résumé du déploiement

Pour déployer Zenwa correctement sur Replit, suivez ces étapes essentielles :

1. Assurez-vous que les fichiers `Procfile`, `replit_deploy.sh`, `run.sh` et `start.sh` sont présents et exécutables
2. Configurez les variables d'environnement requises dans les secrets Replit
3. Dans l'interface Replit, cliquez sur "Deploy" en utilisant la configuration par défaut
4. Vérifiez que votre bot fonctionne en utilisant `/start` dans Telegram

Le système de déploiement est conçu pour utiliser la chaîne de scripts suivante :
`Procfile → replit_deploy.sh → run.sh → start.sh → application`

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
   web: bash replit_deploy.sh
   ```
   
   Ce script exécutera `replit_deploy.sh`, qui est spécifiquement optimisé pour le déploiement sur Replit.

2. **Configurez les scripts de démarrage**
   
   Le projet utilise trois scripts de démarrage:
   
   a) `replit_deploy.sh` - Script principal pour le déploiement Replit:
   ```bash
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
   ```
   
   b) `run.sh` - Script de diagnostic et environnement:
   ```bash
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

   # Vérification des fichiers critiques et variables d'environnement...
   # [voir code complet dans le fichier]

   echo "======================================================"
   echo "=== Démarrage de l'application ==="
   echo "======================================================"

   # Exécuter le script principal
   bash start.sh
   ```
   
   c) `start.sh` - Script d'exécution principal:
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

   # Déterminer le port pour l'application Flask (Replit utilise des variables dynamiques)
   FLASK_PORT=5000
   if [ -n "$PORT" ]; then
     FLASK_PORT=$PORT
     echo "Utilisation du port configuré pour Flask: $PORT"
   fi

   # Démarrer l'application Flask en arrière-plan
   echo "Démarrage du serveur web Flask..."
   gunicorn --bind 0.0.0.0:$FLASK_PORT main:app &
   echo "Serveur web démarré sur le port $FLASK_PORT"

   # Démarrer le bot Telegram (Node.js)
   echo "Démarrage du bot Zenwa..."
   cd src && NODE_ENV=production node index.js
   ```

3. **Variables d'environnement pour le déploiement**
   
   Lors du déploiement sur Replit, vous devez configurer les variables d'environnement suivantes dans la section "Secrets" de l'interface de déploiement :
   
   **Variables essentielles :**
   - `TELEGRAM_BOT_TOKEN` ou `ZENWA_TELEGRAM` : Token d'accès pour le bot Telegram
   - `HEDERA_AI_KIT_ACCOUNT_ID` : ID du compte Hedera pour l'Agent Kit
   - `HEDERA_AI_KIT_PRIVATE_KEY` : Clé privée du compte Hedera
   - `HEDERA_AI_KIT_PUBLIC_KEY` : Clé publique du compte Hedera
   - `OPENAI_API_KEY` : Clé API pour OpenAI
   
   **Variables de base de données :**
   La base de données PostgreSQL est automatiquement configurée dans Replit Deployments via la variable DATABASE_URL.
   
   **Variables facultatives :**
   - `HEDERA_NETWORK` : testnet (par défaut) ou mainnet
   - `PORT` : Défini automatiquement par Replit
   - `NODE_ENV` : Définir à 'production' pour le déploiement
   
   Vous pouvez utiliser le fichier `.env.deployment` comme modèle pour configurer ces variables.

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