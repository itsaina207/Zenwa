/**
 * Test script for minting a new token
 */

const axios = require('axios');

// User ID from the create-wallet.js script
// Replace with your actual user ID
const userId = process.argv[2] || 'test-user-1681234567890';
// Token name
const tokenName = process.argv[3] || 'Test Token';
// Token symbol
const tokenSymbol = process.argv[4] || 'TST';
// Initial supply
const initialSupply = process.argv[5] || 1000;

async function mintToken() {
  try {
    console.log(`Minting token for user ID: ${userId}`);
    console.log(`Token details: Name=${tokenName}, Symbol=${tokenSymbol}, Supply=${initialSupply}`);

    const response = await axios.post('http://localhost:8000/api/wallet/mint', {
      userId,
      tokenInfo: {
        name: tokenName,
        symbol: tokenSymbol,
        initialSupply: parseInt(initialSupply, 10),
      },
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`Token created successfully: ${response.data.tokenName} (${response.data.tokenSymbol})`);
      console.log(`Token ID: ${response.data.tokenId}`);
      console.log(`Initial Supply: ${response.data.initialSupply}`);
      console.log(`Transaction ID: ${response.data.transactionId}`);
      console.log(`Explorer URL: ${response.data.explorerUrl}`);
    } else {
      console.error('Failed to mint token:', response.data.message);
    }
  } catch (error) {
    console.error('Error minting token:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

mintToken();