# Zenwa Bot 24/7 Uptime System

Ce document décrit l'architecture du système qui assure le fonctionnement 24h/24 et 7j/7 du bot Zenwa sur Replit.

## Architecture de la solution

Le système de disponibilité continue repose sur plusieurs mécanismes redondants :

### 1. Auto-ping interne

Dans `src/keep-alive.js`, nous avons implémenté un système complet qui :

- Effectue des pings réguliers (toutes les 4 minutes) vers l'endpoint `/health`
- Surveille les ressources système (mémoire, CPU)
- Génère des rapports d'uptime toutes les 6 heures
- Fournit une détection des problèmes potentiels

### 2. Ping côté client

La page d'accueil intègre un script `keep-alive.js` qui :

- Ping le serveur toutes les 5 minutes
- Met à jour visuellement l'état de la connexion
- Contribue à maintenir l'application active

### 3. API Health Check

Deux endpoints sont exposés pour la surveillance :

- `/health` : API JSON pour les outils automatisés
- `/uptime` : Page web avec tableau de bord pour la surveillance humaine

### 4. Journalisation améliorée

Le système dispose d'une journalisation exhaustive qui facilite l'identification des problèmes :

- Format standardisé avec timestamps
- Catégorisation des messages (KEEP-ALIVE, HEALTH, SYSTEM)
- Détails des erreurs rencontrées

## Intégration avec UptimeRobot

Le système est conçu pour fonctionner avec [UptimeRobot](https://uptimerobot.com/), un service de surveillance externe gratuit.

Configuration recommandée :

1. Créer un compte UptimeRobot
2. Ajouter un nouveau moniteur de type HTTP(s)
3. Utiliser l'URL : `https://votre-app.replit.app/health` 
4. Définir un intervalle de 5 minutes
5. Activer les alertes par email

## Maintenance

Vérifiez régulièrement les indicateurs suivants :

- Messages "[KEEP-ALIVE] Ping #X" dans les logs
- Rapports d'uptime périodiques
- Page `/uptime` pour une vue d'ensemble

## Ressources consommées

Le système de ping utilise très peu de ressources :

- Charge réseau : ~10 requêtes par heure
- Charge CPU : négligeable
- Mémoire : pas d'impact mesurable

## Dépannage

En cas de problème de disponibilité :

1. Vérifiez les logs pour des erreurs système
2. Assurez-vous que le port 8000 est bien écouté
3. Vérifiez si l'application répond sur `/health`
4. Redémarrez le workflow si nécessaire
