# Scripts de test pour le Wallet Custodial Hedera

Ces scripts permettent de tester les fonctionnalités du wallet Hedera via l'API HTTP sans avoir besoin du bot Telegram.

## Prérequis

- Le serveur doit être démarré : `cd src && node index.js`
- Vous aurez besoin de Node.js et Axios (déjà installé dans le projet)

## Scripts disponibles

### 1. Créer un wallet

```bash
node test-scripts/create-wallet.js
```

Ce script va créer un nouveau wallet Hedera et retourner un `userId` que vous devrez utiliser pour les scripts suivants.

### 2. Vérifier le solde

```bash
node test-scripts/get-balance.js <userId>
```

Remplacez `<userId>` par l'ID retourné par le script de création de wallet.

### 3. Envoyer des HBAR

```bash
node test-scripts/send-hbar.js <fromUserId> <toAccountId> <amount>
```

- `<fromUserId>` : ID de l'utilisateur qui envoie les HBAR
- `<toAccountId>` : ID du compte Hedera destinataire
- `<amount>` : Montant en HBAR à envoyer

### 4. Voir l'historique des transactions

```bash
node test-scripts/transaction-history.js <userId> <limit>
```

- `<userId>` : ID de l'utilisateur
- `<limit>` : Nombre de transactions à récupérer (optionnel, par défaut 10)

### 5. Créer un token

```bash
node test-scripts/mint-token.js <userId> <tokenName> <tokenSymbol> <initialSupply>
```

- `<userId>` : ID de l'utilisateur qui crée le token
- `<tokenName>` : Nom du token
- `<tokenSymbol>` : Symbole du token
- `<initialSupply>` : Quantité initiale de tokens à créer

## Exemple de flux de test

1. Créer un wallet :
   ```bash
   node test-scripts/create-wallet.js
   # Notez le userId retourné, par exemple: test-user-1681234567890
   ```

2. Vérifier le solde :
   ```bash
   node test-scripts/get-balance.js test-user-1681234567890
   ```

3. Créer un token :
   ```bash
   node test-scripts/mint-token.js test-user-1681234567890 "My Token" MTK 1000
   ```

4. Vérifier l'historique des transactions :
   ```bash
   node test-scripts/transaction-history.js test-user-1681234567890 5
   ```

## Note importante

Ces scripts utilisent l'API HTTP locale (`http://localhost:8000`). Si votre serveur est accessible via une autre adresse, vous devrez modifier les scripts en conséquence.