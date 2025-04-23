
const {
    AccountId,
    PrivateKey,
    Client,
    TransferTransaction,
    Hbar
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
      
  
    
    // Create a transaction to transfer 1 HBAR
    const txTransfer= new TransferTransaction()
      .addHbarTransfer(MY_ACCOUNT_ID, new Hbar(-1))
      .addHbarTransfer(receiverAccount, new Hbar(1)); //Fill in the receiver account ID
          
    //Submit the transaction to a Hedera network
    const txTransferResponse = await txTransfer.execute(client);

    //Request the receipt of the transaction
    const receiptTransferTx = await txTransferResponse.getReceipt(client);

    //Get the transaction consensus status
    const statusTransferTx= receiptTransferTx.status;

    //Get the Transaction ID
    const txIdTransfer = txTransferResponse.transactionId.toString();

    console.log("-------------------------------- Transfer HBAR ------------------------------ ");
    console.log("Receipt status           :", statusTransferTx.toString());
    console.log("Transaction ID           :", txIdTransfer);
    console.log("Hashscan URL             :", `https://hashscan.io/testnet/tx/${txIdTransfer}`);
      
  } catch (error) {
    console.error(error);
  } finally {
    if (client) client.close();
  }
}

main();
