/**
 * Test script for sending tokens from one account to another
 */

const { sendToken } = require('../hedera/tokens');

async function sendTokens() {
  try {
    const fromUserId = '123456789'; // Change this to your test user ID
    const toAccountId = '0.0.1234'; // Change this to a real Hedera account ID
    const tokenId = '0.0.5678';     // Change this to a real token ID
    const amount = 10;              // Amount of tokens to send
    
    console.log(`Sending ${amount} tokens (${tokenId}) from user ${fromUserId} to account ${toAccountId}...`);
    
    const result = await sendToken(fromUserId, toAccountId, tokenId, amount);
    
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\nTokens sent successfully!');
      console.log(`Transaction ID: ${result.transactionId}`);
      console.log(`Explorer URL: ${result.explorerUrl}`);
    } else {
      console.log(`\nFailed to send tokens: ${result.message}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Execute the test
sendTokens();