/**
 * Test script for sending HBAR from one account to another
 */

const axios = require('axios');

// User ID from the create-wallet.js script
// Replace with your actual user ID
const fromUserId = process.argv[2] || 'test-user-1681234567890';
// Destination Hedera account ID
const toAccountId = process.argv[3] || '0.0.5876043'; // This is just an example, replace with a real account
// Amount of HBAR to send
const amount = process.argv[4] || '0.1';

async function sendHbar() {
  try {
    console.log(`Sending ${amount} HBAR from user ${fromUserId} to account ${toAccountId}`);

    const response = await axios.post('http://localhost:8000/api/wallet/send', {
      fromUserId,
      toAccountId,
      amount,
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`Transaction successful: ${response.data.message}`);
      console.log(`Transaction ID: ${response.data.transactionId}`);
      console.log(`Explorer URL: ${response.data.explorerUrl}`);
    } else {
      console.error('Failed to send HBAR:', response.data.message);
    }
  } catch (error) {
    console.error('Error sending HBAR:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

sendHbar();