/**
 * Test script for creating a new wallet
 */

const axios = require('axios');

async function createWallet() {
  try {
    const userId = 'test-user-' + Date.now();
    console.log(`Creating wallet for user ID: ${userId}`);

    const response = await axios.post('http://localhost:8000/api/wallet/create', { userId });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`Successfully created wallet with account ID: ${response.data.accountId}`);
      // Store this userId for future use
      console.log(`Save this user ID for testing other functions: ${userId}`);
    } else {
      console.error('Failed to create wallet:', response.data.message);
    }
  } catch (error) {
    console.error('Error creating wallet:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

createWallet();