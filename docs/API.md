# Documentation de l'API

Ce document détaille les endpoints de l'API REST exposés par le wallet custodial Hedera.

## Base URL

Toutes les URLs mentionnées sont relatives à :
```
http://localhost:8000/api
```

## Authentification

L'API n'implémente pas actuellement de mécanisme d'authentification. Dans un environnement de production, il est recommandé d'ajouter une couche d'authentification comme JWT.

## Format des réponses

Toutes les réponses sont au format JSON avec la structure suivante :

- Réponse réussie :
```json
{
  "success": true,
  "message": "Description du succès",
  "data": { ... }  // Les données spécifiques à l'endpoint
}
```

- Réponse d'erreur :
```json
{
  "success": false,
  "message": "Description de l'erreur"
}
```

## Endpoints

### Gestion des wallets

#### Créer un wallet
```
POST /wallet/create
```

Crée un nouveau wallet Hedera pour un utilisateur.

**Paramètres de la requête :**
```json
{
  "userId": "string"  // Identifiant de l'utilisateur (généralement ID Telegram)
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Wallet créé avec succès",
  "accountId": "0.0.xxxxx",
  "publicKey": "302a...",
  "privateKey": "302e...",
  "evmAddress": "0x...",
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

#### Obtenir le solde
```
GET /wallet/balance/:userId
```

Récupère le solde HBAR et les tokens détenus par le wallet de l'utilisateur.

**Paramètres de chemin :**
- `userId` : ID de l'utilisateur

**Réponse :**
```json
{
  "success": true,
  "accountId": "0.0.xxxxx",
  "balance": {
    "hbars": "10.00001",
    "tokens": {
      "0.0.yyyyy": 1000,
      "0.0.zzzzz": 500
    }
  }
}
```

#### Envoyer des HBAR
```
POST /wallet/send
```

Envoie des HBAR depuis le wallet de l'utilisateur vers un autre compte Hedera.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "recipientId": "0.0.xxxxx",
  "amount": "10.5"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "10.5 HBAR envoyés avec succès à 0.0.xxxxx",
  "transactionId": "0.0.xxxxx@time",
  "amount": "10.5",
  "fromAccount": "0.0.yyyyy",
  "toAccount": "0.0.xxxxx",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

#### Obtenir l'historique des transactions
```
GET /wallet/history/:userId
```

Récupère l'historique des transactions du wallet de l'utilisateur.

**Paramètres de chemin :**
- `userId` : ID de l'utilisateur

**Paramètres de requête :**
- `limit` (optionnel) : Nombre maximum de transactions à retourner (défaut: 10)

**Réponse :**
```json
{
  "success": true,
  "accountId": "0.0.xxxxx",
  "transactions": [
    {
      "id": "0.0.xxxxx@time",
      "timestamp": "2025-04-20T10:30:00.000Z",
      "type": "CRYPTOTRANSFER",
      "result": "SUCCESS",
      "fee": 0.0001,
      "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
    },
    ...
  ]
}
```

### Gestion des tokens

#### Créer un token
```
POST /wallet/mint
```

Crée un nouveau token fongible.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "tokenInfo": {
    "name": "MyToken",
    "symbol": "MTK",
    "initialSupply": 10000,
    "decimals": 0,
    "maxSupply": 100000000
  }
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Token créé avec succès : MyToken (MTK)",
  "tokenId": "0.0.xxxxx",
  "tokenName": "MyToken",
  "tokenSymbol": "MTK",
  "initialSupply": 10000,
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

#### Envoyer des tokens
```
POST /wallet/sendtoken
```

Transfère des tokens depuis le wallet de l'utilisateur vers un autre compte Hedera.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "toAccountId": "0.0.xxxxx",
  "tokenId": "0.0.yyyyy",
  "amount": 100
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "100 tokens ont été envoyés avec succès à 0.0.xxxxx",
  "tokenId": "0.0.yyyyy",
  "amount": 100,
  "fromAccount": "0.0.zzzzz",
  "toAccount": "0.0.xxxxx",
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

#### Associer un token
```
POST /wallet/associate
```

Associe un token au compte de l'utilisateur.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "tokenId": "0.0.xxxxx"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Token 0.0.xxxxx associé avec succès",
  "tokenId": "0.0.xxxxx",
  "accountId": "0.0.yyyyy",
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

#### Dissocier un token
```
POST /wallet/dissociate
```

Dissocie un token du compte de l'utilisateur.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "tokenId": "0.0.xxxxx"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Token 0.0.xxxxx dissocié avec succès",
  "tokenId": "0.0.xxxxx",
  "accountId": "0.0.yyyyy",
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

### Hedera Consensus Service (HCS)

#### Créer un topic
```
POST /hcs/topic
```

Crée un nouveau topic HCS.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "topicMemo": "Mon Topic de Test",
  "submitKey": false
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Topic créé avec succès",
  "topicId": "0.0.xxxxx",
  "topicMemo": "Mon Topic de Test",
  "isSubmitKey": false,
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/topic/0.0.xxxxx"
}
```

#### Soumettre un message
```
POST /hcs/message
```

Envoie un message à un topic HCS.

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "topicId": "0.0.xxxxx",
  "message": "Ceci est un message de test"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Message soumis avec succès",
  "topicId": "0.0.xxxxx",
  "content": "Ceci est un message de test",
  "transactionId": "0.0.xxxxx@time",
  "explorerUrl": "https://hashscan.io/testnet/tx/0.0.xxxxx@time"
}
```

#### Obtenir les messages d'un topic
```
GET /hcs/messages/:topicId
```

Récupère les messages d'un topic HCS.

**Paramètres de chemin :**
- `topicId` : ID du topic

**Paramètres de requête :**
- `limit` (optionnel) : Nombre maximum de messages à retourner (défaut: 10)

**Réponse :**
```json
{
  "success": true,
  "topicId": "0.0.xxxxx",
  "messages": [
    {
      "consensus_timestamp": "1618943201.0000000001",
      "message": "Ceci est un message de test",
      "sequence_number": 1,
      "running_hash": "0x..."
    },
    ...
  ],
  "total": 5
}
```

### Intégration Hedera Agent Kit

De nombreux endpoints exposent également les fonctionnalités de l'Hedera Agent Kit, avec des fonctionnalités avancées et une API enrichie.

#### Transfert d'HBAR via Agent Kit
```
POST /kit/transfer/hbar
```

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "recipientId": "0.0.xxxxx",
  "amount": "10.5"
}
```

#### Création de token via Agent Kit
```
POST /kit/token/create
```

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "name": "MyToken",
  "symbol": "MTK",
  "initialSupply": 10000,
  "decimals": 0,
  "maxSupply": 100000000
}
```

#### Transfert de token via Agent Kit
```
POST /kit/transfer/token
```

**Paramètres de la requête :**
```json
{
  "userId": "string",
  "recipientId": "0.0.xxxxx",
  "tokenId": "0.0.yyyyy",
  "amount": 100
}
```

## Codes d'erreur

| Code HTTP | Description |
|-----------|-------------|
| 200 | Succès |
| 400 | Requête mal formée ou paramètres invalides |
| 404 | Ressource non trouvée |
| 500 | Erreur interne du serveur |

## Limites

- Toutes les requêtes sont limitées à 60 par minute par adresse IP.
- La taille maximale des messages HCS est de 1024 octets.
- La création de token est limitée à une offre initiale maximale de 100 000 000 unités.