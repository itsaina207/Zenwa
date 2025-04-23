/**
 * Test script for checking wallet balance
 */

const axios = require('axios');

// User ID from the create-wallet.js script
// Replace with your actual user ID
const userId = process.argv[2] || 'test-user-1681234567890';

async function getBalance() {
  try {
    console.log(`Getting balance for user ID: ${userId}`);

    const response = await axios.get(`http://localhost:8000/api/wallet/balance/${userId}`);
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`Account ID: ${response.data.accountId}`);
      console.log(`HBAR Balance: ${response.data.balance.hbars}`);
      console.log(`Tokens: ${JSON.stringify(response.data.balance.tokens)}`);
    } else {
      console.error('Failed to get balance:', response.data.message);
    }
  } catch (error) {
    console.error('Error getting balance:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

getBalance();