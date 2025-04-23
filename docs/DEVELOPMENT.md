# Guide de développement

Ce document fournit des informations détaillées pour les développeurs qui souhaitent contribuer ou étendre le projet de wallet custodial Hedera avec bot Telegram.

## Configuration de l'environnement de développement

### Prérequis

- Node.js v18+ (recommandé: v20.x)
- npm v9+ ou yarn v1.22+
- PostgreSQL v14+
- Compte Telegram Bot (via BotFather)
- Compte développeur Hedera (pour obtenir des identifiants testnet)
- Compte OpenAI (pour l'API)

### Installation des dépendances

```bash
# Cloner le dépôt
git clone https://github.com/yourusername/hedera-telegram-wallet.git
cd hedera-telegram-wallet

# Installer les dépendances
npm install
```

### Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet en vous basant sur le fichier `.env.example` :

```bash
cp .env.example .env
```

Modifiez le fichier `.env` avec vos propres informations :

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

### Configuration de la base de données

Assurez-vous que PostgreSQL est installé et en cours d'exécution sur votre machine. Créez ensuite une base de données pour le projet :

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE hedera_wallet;

# Quitter psql
\q
```

Ou utilisez un outil comme pgAdmin pour créer la base de données visuellement.

### Démarrage en mode développement

```bash
# Démarrer l'application en mode développement
npm run dev
```

L'application sera accessible à l'adresse `http://localhost:8000/api`.

## Structure du projet

La structure du projet est organisée de manière modulaire :

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
├── docs/                  # Documentation
├── tests/                 # Tests
├── .env.example           # Exemple de configuration
├── package.json
└── README.md
```

## Cycle de développement

### 1. Modification du code

Lorsque vous modifiez du code, suivez ces bonnes pratiques :

- Utilisez des noms de variables et de fonctions descriptifs
- Ajoutez des commentaires pour expliquer la logique complexe
- Suivez les conventions de style ESLint du projet
- Maintenez une couverture de tests appropriée

### 2. Tests

Le projet utilise Jest pour les tests unitaires et d'intégration :

```bash
# Exécuter tous les tests
npm test

# Exécuter les tests avec couverture
npm run test:coverage

# Exécuter un test spécifique
npm test -- -t "nom du test"
```

### 3. Déploiement

Pour déployer l'application en production :

```bash
# Construire l'application
npm run build

# Démarrer en mode production
npm start
```

## Points d'extension principaux

### 1. Ajout de nouvelles commandes Telegram

Pour ajouter une nouvelle commande au bot Telegram, modifiez le fichier `src/telegram/commands.js` :

```javascript
function registerCommands(bot) {
  // Commandes existantes...
  
  // Ajouter votre nouvelle commande
  bot.onText(/\/macommande(.*)/, msg => handleMyCommand(bot, msg));
}

// Définir le gestionnaire de votre commande
async function handleMyCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Votre logique ici...
  
  await bot.sendMessage(chatId, "Résultat de votre commande");
}
```

### 2. Extension de l'API REST

Pour ajouter un nouveau endpoint à l'API, modifiez le fichier `src/api.js` :

```javascript
// Ajouter un nouvel endpoint
router.post('/nouveau-endpoint', async (req, res) => {
  try {
    const result = await votreService.executerAction(req.body);
    res.json(result);
  } catch (error) {
    console.error(`API Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});
```

### 3. Intégration de nouvelles fonctionnalités Hedera

Pour ajouter de nouvelles fonctionnalités Hedera, créez un nouveau module dans le répertoire `src/hedera/` ou étendez un module existant.

Par exemple, pour ajouter le support des Smart Contracts :

```javascript
// src/hedera/smart-contracts.js
const { ContractCreateTransaction, ContractCallQuery } = require("@hashgraph/sdk");
const { getClient } = require('./client');

async function deployContract(userId, bytecode, constructorParams) {
  try {
    const client = getClient();
    const wallet = await getWalletByUserId(userId);
    
    // Logique pour déployer un contrat...
    
    return {
      success: true,
      contractId: contractId.toString(),
      // Autres informations...
    };
  } catch (error) {
    console.error(`Error deploying contract: ${error.message}`);
    return {
      success: false,
      message: `Failed to deploy contract: ${error.message}`
    };
  }
}

// Exporter les fonctions
module.exports = {
  deployContract,
  // Autres fonctions...
};
```

## Bonnes pratiques

### 1. Gestion des erreurs

Utilisez des blocs try/catch pour gérer les erreurs et fournir des messages d'erreur clairs :

```javascript
try {
  // Votre code...
} catch (error) {
  console.error(`Erreur spécifique: ${error.message}`);
  return {
    success: false,
    message: `Message d'erreur utilisateur: ${error.message}`
  };
}
```

### 2. Logging

Utilisez des logs appropriés pour faciliter le débogage :

```javascript
console.log("Information normale");
console.info("Information importante");
console.warn("Avertissement");
console.error("Erreur critique");
```

### 3. Validation des entrées

Validez toujours les entrées utilisateur avant de les utiliser :

```javascript
function validateAccountId(accountId) {
  try {
    AccountId.fromString(accountId);
    return true;
  } catch (e) {
    return false;
  }
}

if (!validateAccountId(recipientId)) {
  return {
    success: false,
    message: "ID de compte destinataire invalide"
  };
}
```

### 4. Gestion des transactions

Suivez ce modèle pour les transactions Hedera :

```javascript
// Créer la transaction
const transaction = new SomeTransaction()
  .setParam1(value1)
  .setParam2(value2)
  .freezeWith(client);

// Signer la transaction
const signedTx = await transaction.sign(
  PrivateKey.fromString(privateKey)
);

// Exécuter la transaction
const txResponse = await signedTx.execute(client);

// Obtenir le reçu
const receipt = await txResponse.getReceipt(client);

// Vérifier le statut
if (receipt.status.toString() !== 'SUCCESS') {
  throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
}
```

## Dépannage

### Problèmes de base de données

Si vous rencontrez des problèmes avec la base de données :

```bash
# Vérifier la connexion à PostgreSQL
psql -U postgres -h localhost -d hedera_wallet -c "SELECT 1"

# Vérifier les tables existantes
psql -U postgres -h localhost -d hedera_wallet -c "\dt"
```

### Problèmes avec le bot Telegram

Si le bot ne répond pas :

1. Vérifiez que le token est valide
2. Assurez-vous que le webhook est correctement configuré
3. Consultez les logs pour les erreurs d'API Telegram

### Problèmes avec Hedera

Pour les problèmes liés à Hedera :

1. Vérifiez que votre compte Testnet est correctement configuré
2. Assurez-vous que votre compte a suffisamment de HBAR (utilisez le faucet si nécessaire)
3. Vérifiez les informations du compte sur [DragonGlass](https://testnet.dragonglass.me/) ou [HashScan](https://hashscan.io/testnet)

## Ressources

- [Documentation Hedera](https://docs.hedera.com/)
- [GitHub du SDK Hedera](https://github.com/hashgraph/hedera-sdk-js)
- [Documentation de l'API Telegram Bot](https://core.telegram.org/bots/api)
- [Documentation OpenAI](https://platform.openai.com/docs/)