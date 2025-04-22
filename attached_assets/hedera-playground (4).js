
const {
    AccountId,
    PrivateKey,
    Client,
    AccountCreateTransaction,
    Hbar,
    AccountUpdateTransaction,
    AccountAllowanceApproveTransaction,
    AccountBalanceQuery,
    TokenCreateTransaction,
    TokenType,
    TransferTransaction,
    TokenAirdropTransaction
  } = require("@hashgraph/sdk"); // v2.46.0

async function main() {
  let client;
  try {
    // Your account ID and private key from string value
    const MY_ACCOUNT_ID = AccountId.fromString("0.0.5876043");
    const MY_PRIVATE_KEY = PrivateKey.fromStringECDSA("84891e1414cd4f0fa75abaf0f4f13bc46a6082234682d4a5fe88c2885a46270a");

    // Pre-configured client for test network (testnet)
    client = Client.forTestnet();

    //Set the operator with the account ID and private key
    client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

    // Start your code here
  
    
    // Generate a new key for the account
    const accountPrivateKey = PrivateKey.generateECDSA();
    const accountPublicKey = accountPrivateKey.publicKey;
    
    const txCreateAccount = new AccountCreateTransaction()
      .setAlias(accountPublicKey.toEvmAddress()) //Do NOT set an alias if you need to update/rotate keys 
      .setKey(accountPublicKey)
      .setInitialBalance(new Hbar(10));
    
    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txCreateAccountResponse = await txCreateAccount.execute(client);

    //Request the receipt of the transaction
    const receiptCreateAccountTx= await txCreateAccountResponse.getReceipt(client);

    //Get the transaction consensus status
    const statusCreateAccountTx = receiptCreateAccountTx.status;

    //Get the Account ID o
    const accountId = receiptCreateAccountTx.accountId;

    //Get the Transaction ID 
    const txIdAccountCreated = txCreateAccountResponse.transactionId.toString();

    console.log("------------------------------ Create Account ------------------------------ ");
    console.log("Receipt status       :", statusCreateAccountTx.toString());
    console.log("Transaction ID       :", txIdAccountCreated);
    console.log("Hashscan URL         :", `https://hashscan.io/testnet/tx/${txIdAccountCreated}`);
    console.log("Account ID           :", accountId.toString());
    console.log("Private key          :", accountPrivateKey.toString());
    console.log("Public key           :", accountPublicKey.toString());
    
  
    
    //Generate a new key for the account
    const newAccountPrivateKey = PrivateKey.generateECDSA();
    const newAccountPublicKey = newAccountPrivateKey.publicKey;

    //Create the transaction to update the key on the account
    const txUpdate = await new AccountUpdateTransaction()
      .setAccountId(accountId) //Fill in the account ID
      .setKey(newAccountPrivateKey)
      .freezeWith(client);

    //Sign the transaction with the old key and new key
    const signTxUpdate = await (await txUpdate.sign(accountPrivateKey)).sign(newAccountPrivateKey);

    //Submit to a Hedera network
    const txUpdateResponse = await signTxUpdate.execute(client);

    //Request the receipt of the transaction
    const receiptUpdateTx= await txUpdateResponse.getReceipt(client);

    //Get the transaction consensus status
    const statusUpdateTx = receiptUpdateTx.status;

    //Get the Transaction ID
    const txIdAccountUpdated = txUpdateResponse.transactionId.toString();

    console.log("------------------------------ Update Account ------------------------------ ");
    console.log("Receipt status           :", statusUpdateTx.toString());
    console.log("Transaction ID           :", txIdAccountUpdated);
    console.log("Hashscan URL             :", `https://hashscan.io/testnet/tx/${txIdAccountUpdated}`);
    console.log("New Private Key          :", newAccountPrivateKey.toString());
    console.log("New Public Key           :", newAccountPublicKey.toString());
      
  
    
    //Create the transaction
    const txApproveAllowance = await new AccountAllowanceApproveTransaction()
      .approveHbarAllowance(MY_ACCOUNT_ID, spenderAccount, Hbar.from(1)).freezeWith(client);; //Fill in the spender Account ID
          
    //Sign the transaction with the owner account key
    const signTxApproveAllowance= await txApproveAllowance.sign(MY_PRIVATE_KEY); 

    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txResponseApproveAllowance = await signTxApproveAllowance.execute(client);

    //Request the receipt of the transaction
    const receiptApproveAllowanceTx = await txResponseApproveAllowance.getReceipt(client);

    //Get the transaction consensus status
    const statusApproveAllowanceTx = receiptApproveAllowanceTx.status;

    //Get the Transaction ID
    const txIdApproveAllowance = txResponseApproveAllowance.transactionId.toString();

    console.log("-------------------------------- Approve Allowance ------------------------------ ");
    console.log("Receipt status           :", statusApproveAllowanceTx.toString());
    console.log("Transaction ID           :", txIdApproveAllowance);
    console.log("Hashscan URL             :", `https://hashscan.io/testnet/tx/${txIdApproveAllowance}`);
    
  
    
    //Create the account balance query
    const accountBalanceQuery = new AccountBalanceQuery()
      .setAccountId(MY_ACCOUNT_ID);

    //Submit the query to a Hedera network
    const accountBalance = await accountBalanceQuery.execute(client);

    console.log("-------------------------------- Account Balance ------------------------------");
    console.log("HBAR account balance     :", accountBalance.hbars.toString());
    console.log("Token account balance    :", accountBalance.tokens.toString());
    
  
    
    //Create the transaction and freeze for manual signing
    const txTokenCreate = await new TokenCreateTransaction()
      .setTokenName("Your Token Name")
      .setTokenSymbol("F")
      .setTokenType(TokenType.FUNGIBLE_COMMON)
      .setTreasuryAccountId(MY_ACCOUNT_ID)
      .setInitialSupply(5000)
      .freezeWith(client);

    //Sign the transaction with the token treasury account private key
    const signTxTokenCreate =  await txTokenCreate.sign(MY_PRIVATE_KEY);

    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txTokenCreateResponse = await signTxTokenCreate.execute(client);

    //Get the receipt of the transaction
    const receiptTokenCreateTx = await txTokenCreateResponse.getReceipt(client);

    //Get the token ID from the receipt
    const tokenId = receiptTokenCreateTx.tokenId;

    //Get the transaction consensus status
    const statusTokenCreateTx = receiptTokenCreateTx.status;

    //Get the Transaction ID
    const txTokenCreateId = txTokenCreateResponse.transactionId.toString();

    console.log("--------------------------------- Token Creation ---------------------------------");
    console.log("Receipt status           :", statusTokenCreateTx.toString());
    console.log("Transaction ID           :", txTokenCreateId);
    console.log("Hashscan URL             :", "https://hashscan.io/testnet/tx/" + txTokenCreateId);
    console.log("Token ID                 :", tokenId.toString());
    
  
    
    //Create the transfer transaction
    const txTransfer = await new TransferTransaction()
      .addTokenTransfer(tokenId, MY_ACCOUNT_ID, -1) //Fill in the token ID 
      .addTokenTransfer(tokenId,receiverAccount, 1) //Fill in the token ID and receiver account
      .freezeWith(client);

    //Sign with the sender account private key
    const signTxTransfer = await txTransfer.sign(MY_PRIVATE_KEY);

    //Sign with the client operator private key and submit to a Hedera network
    const txTransferResponse = await signTxTransfer.execute(client);

    //Request the receipt of the transaction
    const receiptTransferTx = await txTransferResponse.getReceipt(client);

    //Obtain the transaction consensus status
    const statusTransferTx = receiptTransferTx.status;

    //Get the Transaction ID
    const txTransferId = txTransferResponse.transactionId.toString();

    console.log("--------------------------------- Token Transfer ---------------------------------");
    console.log("Receipt status           :", statusTransferTx.toString());
    console.log("Transaction ID           :", txTransferId);
    console.log("Hashscan URL             :", "https://hashscan.io/testnet/tx/" + txTransferId);
      
  
    
    //Create the token airdrop transaction for fungible token
    const txTokenAirdrop = await new TokenAirdropTransaction()
      .addTokenTransfer(tokenId, MY_ACCOUNT_ID, -1) //Fill in the token ID
      .addTokenTransfer(tokenId, receiverAccount1, 1) //Fill in the token ID and receiver account
      .addTokenTransfer(tokenId, MY_ACCOUNT_ID, -1)  //Fill in the token ID
      .addTokenTransfer(tokenId, receiverAccount2, 1) //Fill in the token ID and receiver account
      .freezeWith(client);
            
    //Sign with the sender account key 
    const signTxTokenAirdrop = await txTokenAirdrop.sign(MY_PRIVATE_KEY);

    //Submit the transaction to a Hedera network
    const txTokenAirdropResponse = await signTxTokenAirdrop.execute(client);

    //Request the receipt of the transaction
    const receiptTokenAirdropTx = await txTokenAirdropResponse.getReceipt(client);
          
    //Get the transaction consensus status
    const statusTokenAirdropTx  = receiptTokenAirdropTx.status;

    //Get the Transaction ID
    const txTokenAirdropId = txTokenAirdropResponse.transactionId.toString();

    console.log("--------------------------------- Create Token Airdrop ---------------------------------");
    console.log("Receipt status           :", statusTokenAirdropTx.toString());
    console.log("Transaction ID           :", txTokenAirdropId);
    console.log("Hashscan URL             :", "https://hashscan.io/testnet/tx/" + txTokenAirdropId);
    
  
    
    // Generate a new key for the account
    const accountPrivateKey = PrivateKey.generateECDSA();
    const accountPublicKey = accountPrivateKey.publicKey;
    
    const txCreateAccount = new AccountCreateTransaction()
      .setAlias(accountPublicKey.toEvmAddress()) //Do NOT set an alias if you need to update/rotate keys 
      .setKey(accountPublicKey)
      .setInitialBalance(new Hbar(10));
    
    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txCreateAccountResponse = await txCreateAccount.execute(client);

    //Request the receipt of the transaction
    const receiptCreateAccountTx= await txCreateAccountResponse.getReceipt(client);

    //Get the transaction consensus status
    const statusCreateAccountTx = receiptCreateAccountTx.status;

    //Get the Account ID o
    const accountId = receiptCreateAccountTx.accountId;

    //Get the Transaction ID 
    const txIdAccountCreated = txCreateAccountResponse.transactionId.toString();

    console.log("------------------------------ Create Account ------------------------------ ");
    console.log("Receipt status       :", statusCreateAccountTx.toString());
    console.log("Transaction ID       :", txIdAccountCreated);
    console.log("Hashscan URL         :", `https://hashscan.io/testnet/tx/${txIdAccountCreated}`);
    console.log("Account ID           :", accountId.toString());
    console.log("Private key          :", accountPrivateKey.toString());
    console.log("Public key           :", accountPublicKey.toString());
    
  
    
    //Create the account balance query
    const accountBalanceQuery = new AccountBalanceQuery()
      .setAccountId(MY_ACCOUNT_ID);

    //Submit the query to a Hedera network
    const accountBalance = await accountBalanceQuery.execute(client);

    console.log("-------------------------------- Account Balance ------------------------------");
    console.log("HBAR account balance     :", accountBalance.hbars.toString());
    console.log("Token account balance    :", accountBalance.tokens.toString());
    
  
    
    // Generate a new key for the account
    const accountPrivateKey = PrivateKey.generateECDSA();
    const accountPublicKey = accountPrivateKey.publicKey;
    
    const txCreateAccount = new AccountCreateTransaction()
      .setAlias(accountPublicKey.toEvmAddress()) //Do NOT set an alias if you need to update/rotate keys 
      .setKey(accountPublicKey)
      .setInitialBalance(new Hbar(10));
    
    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txCreateAccountResponse = await txCreateAccount.execute(client);

    //Request the receipt of the transaction
    const receiptCreateAccountTx= await txCreateAccountResponse.getReceipt(client);

    //Get the transaction consensus status
    const statusCreateAccountTx = receiptCreateAccountTx.status;

    //Get the Account ID o
    const accountId = receiptCreateAccountTx.accountId;

    //Get the Transaction ID 
    const txIdAccountCreated = txCreateAccountResponse.transactionId.toString();

    console.log("------------------------------ Create Account ------------------------------ ");
    console.log("Receipt status       :", statusCreateAccountTx.toString());
    console.log("Transaction ID       :", txIdAccountCreated);
    console.log("Hashscan URL         :", `https://hashscan.io/testnet/tx/${txIdAccountCreated}`);
    console.log("Account ID           :", accountId.toString());
    console.log("Private key          :", accountPrivateKey.toString());
    console.log("Public key           :", accountPublicKey.toString());
    
  } catch (error) {
    console.error(error);
  } finally {
    if (client) client.close();
  }
}

main();
