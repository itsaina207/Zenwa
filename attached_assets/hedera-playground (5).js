
const {
    AccountId,
    PrivateKey,
    Client,
    AccountBalanceQuery
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
  
    
    //Create the account balance query
    const accountBalanceQuery = new AccountBalanceQuery()
      .setAccountId(MY_ACCOUNT_ID);

    //Submit the query to a Hedera network
    const accountBalance = await accountBalanceQuery.execute(client);

    console.log("-------------------------------- Account Balance ------------------------------");
    console.log("HBAR account balance     :", accountBalance.hbars.toString());
    console.log("Token account balance    :", accountBalance.tokens.toString());
    
  } catch (error) {
    console.error(error);
  } finally {
    if (client) client.close();
  }
}

main();
