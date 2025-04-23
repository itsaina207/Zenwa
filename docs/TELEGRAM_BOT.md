# Guide du Bot Telegram

Ce document détaille les fonctionnalités et l'utilisation du bot Telegram pour le wallet custodial Hedera.

## À propos du bot

Le bot Telegram est une interface conversationnelle qui vous permet d'interagir avec votre wallet Hedera directement depuis l'application Telegram. Il combine des commandes traditionnelles (commençant par "/") et une compréhension du langage naturel pour offrir une expérience utilisateur fluide et intuitive.

## Fonctionnalités

### 1. Gestion de wallet

- Création d'un nouveau wallet Hedera
- Consultation du solde (HBAR et tokens)
- Envoi d'HBAR à d'autres comptes
- Consultation de l'historique des transactions

### 2. Gestion des tokens

- Création de tokens fongibles avec un processus interactif guidé
- Support futur pour les tokens non-fongibles
- Envoi de tokens à d'autres comptes
- Association et dissociation de tokens

### 3. Hedera Consensus Service

- Création de topics HCS
- Envoi de messages à des topics
- Consultation des messages d'un topic

### 4. Interface en langage naturel

- Compréhension des requêtes en langage naturel
- Analyse contextuelle des demandes
- Support pour diverses formulations

## Commandes disponibles

### Commandes de base

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/start` | Démarrer la conversation avec le bot | `/start` |
| `/help` | Afficher l'aide et la liste des commandes | `/help` |

### Gestion du wallet

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/createwallet` | Créer un nouveau wallet Hedera | `/createwallet` |
| `/balance` | Vérifier le solde de votre wallet | `/balance` |
| `/send [adresse] [montant]` | Envoyer des HBAR | `/send 0.0.12345 10` |
| `/history [limite]` | Consulter l'historique des transactions | `/history 5` |

### Gestion des tokens

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/mint [nom] [symbole] [offre]` | Créer un nouveau token | `/mint MonToken MTK 1000` |
| `/sendtoken [adresse] [tokenId] [montant]` | Envoyer des tokens | `/sendtoken 0.0.12345 0.0.67890 50` |

## Processus interactifs

### Création de wallet

La commande `/createwallet` ne nécessite aucun paramètre supplémentaire. Le bot créera un nouveau wallet Hedera pour vous et affichera les informations du compte, y compris :

- Account ID
- EVM Address
- Clés publique et privée
- ID de transaction
- Lien vers l'explorateur blockchain

⚠️ **Important** : Sauvegardez vos clés privées en lieu sûr.

### Envoi d'HBAR

La commande `/send` peut être utilisée de deux façons :

1. **Commande directe** : `/send 0.0.12345 10`
2. **Processus interactif** :
   - `/send` (sans paramètres)
   - Le bot vous demandera l'adresse du destinataire
   - Puis le montant à envoyer

### Création de token

La commande `/mint` peut être utilisée de deux façons :

1. **Commande directe** : `/mint MonToken MTK 1000`
2. **Processus interactif** :
   - `/mint` (sans paramètres)
   - Le bot vous guidera à travers les étapes suivantes :
     1. Choix du type de token (fongible ou non-fongible)
     2. Nom du token
     3. Symbole du token
     4. Offre initiale

### Remarque sur la supply maximale

La supply maximale pour les tokens fongibles est limitée à 100 000 000 unités. Si vous spécifiez une valeur supérieure, elle sera automatiquement plafonnée à cette limite.

## Utilisation du langage naturel

Le bot comprend également des commandes en langage naturel, sans nécessiter les préfixes "/". Voici quelques exemples :

### Exemples de requêtes en langage naturel

| Intention | Exemples de phrases |
|-----------|---------------------|
| Vérifier le solde | "Quel est mon solde ?", "Montre-moi mes HBAR", "Combien d'argent ai-je dans mon wallet ?" |
| Créer un wallet | "Crée-moi un wallet", "J'ai besoin d'un nouveau compte Hedera" |
| Envoyer des HBAR | "Envoie 5 HBAR à 0.0.12345", "Transfère 10 hbar au compte 0.0.67890" |
| Créer un token | "Crée un token appelé GameCoin", "Je veux créer un nouveau token" |
| Consulter l'historique | "Montre-moi mon historique", "Quelles sont mes dernières transactions ?" |
| Créer un topic | "Crée un topic nommé News", "Nouveau topic : Announcements" |

## Guide de dépannage

### Problèmes courants

1. **"Je n'ai pas pu comprendre votre demande"**
   - Essayez de reformuler votre requête en termes plus simples
   - Utilisez une commande directe avec "/" si le langage naturel ne fonctionne pas

2. **"Aucun wallet trouvé. Créez-en un d'abord avec /createwallet"**
   - Vous devez créer un wallet avant de pouvoir effectuer des opérations
   - Utilisez la commande `/createwallet`

3. **"Transaction failed"**
   - Vérifiez que vous avez suffisamment de solde pour la transaction
   - Assurez-vous que l'adresse de destination est valide
   - Pour les tokens, vérifiez que le compte destinataire est associé au token

### Liens vers les explorateurs blockchain

Toutes les transactions réussies incluent des liens vers les explorateurs blockchain suivants :

- [HashScan](https://hashscan.io/testnet) - Explorateur principal pour Hedera Testnet
- DragonGlass (lien fourni dans les réponses)

Utilisez ces liens pour vérifier les détails des transactions et suivre leur statut sur le réseau.

## Bonnes pratiques de sécurité

1. **Ne partagez jamais vos clés privées** : Le bot affiche votre clé privée lors de la création du wallet. Sauvegardez-la en lieu sûr et ne la partagez jamais.

2. **Vérifiez les adresses** : Avant d'envoyer des HBAR ou des tokens, vérifiez toujours que l'adresse du destinataire est correcte.

3. **Commencez avec de petits montants** : Pour tester les fonctionnalités, utilisez d'abord de petits montants avant de procéder à des transactions plus importantes.

4. **Ne stockez pas de grandes sommes** : Ce wallet est custodial et conçu principalement pour des fins de démonstration et d'apprentissage.

## Ressources supplémentaires

- [Documentation de l'API REST](./API.md)
- [Architecture du projet](./ARCHITECTURE.md)
- [Guide de développement](./DEVELOPMENT.md)
- [Hedera Developer Portal](https://docs.hedera.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)