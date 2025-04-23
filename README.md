# Hedera Custodial Wallet avec Bot Telegram

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Hedera](https://img.shields.io/badge/Hedera-Hashgraph-00BFFF)
![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)

Une application de wallet custodial Hedera avec intégration de bot Telegram, offrant une gestion complète des actifs Hedera via une interface conversationnelle, propulsée par l'Hedera Agent Kit officiel et OpenAI.

## Caractéristiques

- 🔐 **Gestion de wallet custodial** - Création et gestion sécurisée de comptes Hedera
- 💰 **Transfert d'HBAR** - Envoi et réception d'HBAR entre comptes Hedera
- 🪙 **Gestion des tokens** - Création et transfert de tokens fongibles avec processus interactif
- 📜 **Hedera Consensus Service** - Création de topics, envoi et récupération de messages
- 📊 **Historique des transactions** - Consultation de l'historique des transactions avec liens vers les explorateurs blockchain
- 🤖 **Interface de bot Telegram** - Interaction avec le wallet via commandes ou langage naturel
- 🧠 **Compréhension du langage naturel** - Analyse des demandes utilisateur avec l'API OpenAI
- 🔗 **Intégration de l'Hedera Agent Kit** - Utilisation de l'API officielle pour les opérations blockchain

## Technologies utilisées

- **Backend**: Node.js, Express.js
- **Blockchain**: Hedera Hashgraph, Hedera Agent Kit
- **Base de données**: PostgreSQL
- **Communication**: Telegram Bot API
- **IA**: API OpenAI pour l'analyse du langage naturel
- **Persistance**: Stockage sécurisé des clés privées

## Configuration

### Prérequis

- Node.js v18+
- PostgreSQL
- Compte Hedera Testnet
- Compte Telegram Bot (via BotFather)
- Compte OpenAI pour l'API

### Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
# Hedera configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=your_hedera_account_id
HEDERA_PRIVATE_KEY=your_hedera_private_key
HEDERA_PUBLIC_KEY=your_hedera_public_key

# Hedera Agent Kit configuration
HEDERA_AI_KIT_EVM_ADDRESS=your_hedera_agent_kit_evm_address
HEDERA_AI_KIT_ACCOUNT_ID=your_hedera_agent_kit_account_id
HEDERA_AI_KIT_PUBLIC_KEY=your_hedera_agent_kit_public_key
HEDERA_AI_KIT_PRIVATE_KEY=your_hedera_agent_kit_private_key

# Telegram Bot configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI configuration
OPENAI_API_KEY=your_openai_api_key

# Database configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hedera_wallet
```

### Installation

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/yourusername/hedera-telegram-wallet.git
   cd hedera-telegram-wallet
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Configurez la base de données :
   ```bash
   # Assurez-vous que PostgreSQL est en cours d'exécution
   # La base de données sera créée automatiquement au démarrage
   ```

4. Démarrez l'application :
   ```bash
   npm start
   ```

## Utilisation

### Commandes du bot Telegram

| Commande | Description |
|----------|-------------|
| `/start` | Démarrer la conversation avec le bot |
| `/help` | Afficher l'aide et la liste des commandes |
| `/createwallet` | Créer un nouveau wallet Hedera |
| `/balance` | Vérifier le solde de votre wallet |
| `/send` | Envoyer des HBAR à un autre compte |
| `/sendtoken` | Envoyer des tokens à un autre compte |
| `/mint` | Créer un nouveau token (processus interactif) |
| `/history` | Consulter l'historique des transactions |

### Interaction en langage naturel

Le bot comprend également des commandes en langage naturel, par exemple :

- "Quel est mon solde ?"
- "Crée un nouveau wallet"
- "Envoie 5 HBAR à 0.0.12345"
- "Crée un token appelé MyToken"
- "Montre-moi mon historique de transactions"
- "Crée un topic nommé MonTopic"

## Architecture

Le projet est organisé selon la structure suivante :

```
hedera-telegram-wallet/
├── src/
│   ├── agent/             # Intégration de l'Hedera Agent Kit
│   ├── hedera/            # Opérations Hedera de base
│   ├── services/          # Services (OpenAI, etc.)
│   ├── storage/           # Gestion de la base de données
│   ├── telegram/          # Intégration du bot Telegram
│   ├── utils/             # Utilitaires
│   ├── api.js             # API REST
│   ├── config.js          # Configuration
│   └── index.js           # Point d'entrée
├── docs/                  # Documentation technique détaillée
├── .env.example           # Exemple de fichier de configuration
├── package.json
└── README.md
```

## Documentation technique

Pour une documentation plus détaillée sur l'API, les fonctionnalités et l'architecture, consultez les documents dans le répertoire [docs/](./docs/).

## Sécurité

Ce wallet est **custodial**, ce qui signifie que les clés privées des utilisateurs sont stockées sur le serveur. Il est recommandé d'utiliser ce projet uniquement à des fins de démonstration ou pour de petites sommes.

Pour une utilisation en production, considérez les améliorations suivantes :
- Chiffrement des clés privées
- Authentification multi-facteurs
- Limites de transaction
- Surveillance et alertes

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à soumettre une Pull Request ou à ouvrir une Issue pour toute suggestion ou problème.

1. Forkez le projet
2. Créez votre branche de fonctionnalité (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add some amazing feature'`)
4. Poussez vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Contact

Pour toute question ou suggestion, n'hésitez pas à nous contacter :
- Courriel : votre.email@exemple.com
- GitHub : [votre-nom-github](https://github.com/votre-nom-github)

---

Développé avec ❤️ pour la communauté Hedera