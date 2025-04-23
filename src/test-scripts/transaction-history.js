/**
 * Test script for getting transaction history
 */

const axios = require('axios');

// User ID from the create-wallet.js script
// Replace with your actual user ID
const userId = process.argv[2] || 'test-user-1681234567890';
// Number of transactions to retrieve
const limit = process.argv[3] || 10;

async function getTransactionHistory() {
  try {
    console.log(`Getting transaction history for user ID: ${userId} (limit: ${limit})`);

    const response = await axios.get(`http://localhost:8000/api/wallet/history/${userId}?limit=${limit}`);
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`Account ID: ${response.data.accountId}`);
      console.log(`Number of transactions: ${response.data.transactions.length}`);
      
      if (response.data.transactions.length > 0) {
        console.log('\nTransaction list:');
        response.data.transactions.forEach((tx, index) => {
          console.log(`\n${index + 1}. ${tx.type}`);
          console.log(`   Date: ${tx.timestamp}`);
          console.log(`   Result: ${tx.result}`);
          console.log(`   Fee: ${tx.fee} HBAR`);
          console.log(`   Explorer URL: ${tx.explorerUrl}`);
        });
      } else {
        console.log('No transactions found');
      }
    } else {
      console.error('Failed to get transaction history:', response.data.message);
    }
  } catch (error) {
    console.error('Error getting transaction history:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

getTransactionHistory();