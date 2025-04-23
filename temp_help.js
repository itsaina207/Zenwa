  const message = `
*Aide du Bot de Wallet Custodial Hedera*

Commandes disponibles :

/createwallet - Créer un nouveau compte Hedera
/balance - Vérifier le solde de votre wallet
/send _<accountId> <montant>_ - Envoyer des HBAR à un autre compte
/sendtoken _<accountId> <tokenId> <montant>_ - Envoyer des tokens à un autre compte
/history - Consulter l'historique de vos transactions
/mint _<nom> <symbole> <offre>_ - Créer un nouveau token (tous les paramètres sont optionnels)
/help - Afficher ce message d'aide

*Exemples :*
- Envoyer 5 HBAR : /send 0.0.1234 5
- Envoyer 10 tokens : /sendtoken 0.0.1234 0.0.5678 10
- Créer un token : /mint MonToken MTK 1000

Ce wallet est custodial - vos clés privées sont stockées en toute sécurité sur notre serveur.
  `;
