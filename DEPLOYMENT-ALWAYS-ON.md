# Configuration Always-On pour Zenwa

Ce document explique comment le système Always-On a été configuré pour assurer que le bot Telegram Zenwa fonctionne 24/7, même lorsque l'interface Replit est fermée.

## Architecture

Le système fonctionne grâce à plusieurs composants qui travaillent ensemble :

### 1. Configuration Replit

- **Dans `.replit-info.json`** :
  - `"alwaysOn": true`: Indique à Replit de maintenir l'application active en permanence
  - `"enableCronJob": true`: Active les tâches planifiées pour la surveillance
  - `"port": 8000`: Configure le port principal sur 8000 (port du bot Telegram)
  - `"deployment": { "alwaysOn": true, "deploymentTarget": "cloud" }`: Pour déploiement cloud

- **Dans `Procfile`** :
  - `web: node replit.js`: Démarre l'application principale
  - `worker: node worker.js`: Démarre un processus de surveillance séparé

### 2. Point d'entrée (replit.js)

- Démarre le serveur web Express
- Initialise le client Hedera
- Démarre le bot Telegram
- Lance deux processus de surveillance :
  - `always-on.js`: Système principal de ping
  - `worker.js`: Système de secours pour maintenir l'activité

### 3. Processus de surveillance

- **always-on.js** :
  - Vérifie l'état des services (ports 5000 et 8000)
  - Ping l'URL externe de l'application
  - Démarre un serveur HTTP sur le port 9999 pour les diagnostics

- **worker.js** :
  - Processus indépendant de surveillance
  - Vérifie régulièrement les services
  - Démarre un serveur HTTP sur le port 9998

### 4. Page de monitoring

- Accessible via `/uptime`
- Affiche l'état des services et les statistiques

## Fonctionnement

Lorsque l'application est déployée :

1. Replit exécute `node replit.js` (défini dans Procfile)
2. Le serveur Express démarre et le bot Telegram est initialisé
3. Les processus de surveillance sont lancés
4. Le paramètre `alwaysOn: true` maintient l'application active même lorsque l'interface est fermée
5. Les processus de surveillance envoient des requêtes régulières pour maintenir l'activité

## Surveillance et maintenance

Pour vérifier l'état du système :

1. Accédez à la page `/uptime` de l'application
2. Vérifiez les logs de Replit pour les messages de chaque processus :
   - Messages `[REPLIT-DEPLOY]`: Processus principal
   - Messages `[ALWAYS-ON]`: Processus always-on.js
   - Messages `[WORKER]`: Processus worker.js
   - Messages `[KEEP-ALIVE]`: Système de keep-alive intégré

## Conclusion

Grâce à cette architecture multicouche, l'application Zenwa est conçue pour fonctionner 24/7 sur Replit. Chaque couche offre une redondance qui maximise la fiabilité et la disponibilité du bot Telegram.
