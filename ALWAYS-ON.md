# Système Always-On pour Zenwa

Ce document explique comment fonctionne le système Always-On mis en place pour garantir que l'application Zenwa fonctionne 24/7 sur Replit même lorsque la fenêtre Replit est fermée.

## Architecture

Le système Always-On repose sur plusieurs composants qui travaillent ensemble :

1. **Configuration Replit** :
   - Le paramètre `alwaysOn: true` dans `.replit-info.json` indique à Replit de maintenir l'application active
   - La commande de démarrage est configurée pour utiliser `node replit.js`

2. **Point d'entrée simplifié (replit.js)** :
   - Contourne les problèmes potentiels avec les scripts shell dans l'environnement Replit
   - Démarre tous les services nécessaires (Flask, bot Telegram, etc.)
   - Lance le script Always-On en arrière-plan

3. **Script Always-On (always-on.js)** :
   - Ping régulièrement les services locaux pour vérifier leur état
   - Ping l'URL externe de l'application pour la maintenir active
   - Démarre un petit serveur HTTP sur le port 9999 pour les diagnostics

4. **Page de monitoring** :
   - Accessible via `/always-on` sur le site web
   - Affiche l'état des services et les statistiques d'uptime
   - Permet aux utilisateurs de contribuer à maintenir l'application active

## Fonctionnement

Le système fonctionne selon le principe suivant :

1. Lorsque l'application est déployée, `replit.js` est exécuté en tant que point d'entrée principal
2. `replit.js` démarre les services principaux (Flask, bot Telegram) et lance `always-on.js` en arrière-plan
3. `always-on.js` effectue des pings réguliers (toutes les 5 minutes) aux différents services
4. Ces pings maintiennent l'application active, même lorsque l'interface Replit est fermée
5. La page de monitoring permet de vérifier que tout fonctionne correctement

## Surveillance et maintenance

Pour vérifier l'état du système Always-On :

1. Accédez à la page `/uptime` de l'application
2. Vérifiez les indicateurs d'état (vert = en ligne, rouge = hors ligne)
3. Consultez les statistiques d'uptime et de performance

En cas de problème :

1. Vérifiez les logs de Replit pour identifier d'éventuelles erreurs
2. Redémarrez manuellement le workflow `run_hedera_wallet` si nécessaire
3. Vérifiez que le paramètre `alwaysOn: true` est bien configuré dans `.replit-info.json`

## Conclusion

Grâce à cette architecture à plusieurs niveaux, l'application Zenwa peut fonctionner 24/7 sur Replit même lorsque la fenêtre du navigateur est fermée. Le système offre également des possibilités de surveillance et de diagnostic pour faciliter la maintenance.
