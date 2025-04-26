/**
 * PostgreSQL storage for user wallets
 * Provides persistent storage of wallet data using a database
 */

const { query } = require('./db');

// Initialize the database table if it doesn't exist
async function initializeDatabase() {
  try {
    // Create the user_wallets table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS user_wallets (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL,
        private_key TEXT NOT NULL,
        public_key TEXT NOT NULL,
        evm_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Initialize database tables on module load
initializeDatabase().catch(err => {
  console.error('Failed to initialize database tables:', err);
});

/**
 * Store a wallet for a user
 * @param {object} wallet - Wallet object
 * @returns {Promise<boolean>} Success status
 */
async function storeWallet(wallet) {
  try {
    if (!wallet || !wallet.userId || !wallet.accountId || !wallet.privateKey) {
      console.error('Invalid wallet data provided');
      return false;
    }
    
    // Insert or update wallet data
    const sql = `
      INSERT INTO user_wallets 
        (user_id, account_id, private_key, public_key, evm_address, username)
      VALUES 
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        account_id = $2,
        private_key = $3,
        public_key = $4,
        evm_address = $5,
        username = $6
      RETURNING id;
    `;
    
    const values = [
      wallet.userId,
      wallet.accountId,
      wallet.privateKey,
      wallet.publicKey,
      wallet.evmAddress || null,
      wallet.username || null
    ];
    
    const result = await query(sql, values);
    
    if (result.rows.length > 0) {
      console.log(`Wallet stored for user ${wallet.userId} with account ${wallet.accountId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error storing wallet:', error);
    return false;
  }
}

/**
 * Get wallet by user ID
 * @param {string} userId - Telegram user ID
 * @returns {Promise<object|null>} Wallet object or null if not found
 */
async function getWalletByUserId(userId) {
  try {
    const sql = 'SELECT * FROM user_wallets WHERE user_id = $1';
    const result = await query(sql, [userId]);
    
    if (result.rows.length > 0) {
      const wallet = result.rows[0];
      return {
        userId: wallet.user_id,
        accountId: wallet.account_id,
        privateKey: wallet.private_key,
        publicKey: wallet.public_key,
        evmAddress: wallet.evm_address,
        username: wallet.username,
        created: wallet.created_at
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting wallet by user ID:', error);
    return null;
  }
}

/**
 * Get wallet by username
 * @param {string} username - Telegram username (with or without @)
 * @returns {Promise<object|null>} Wallet object or null if not found
 */
async function getWalletByUsername(username) {
  try {
    // Normalize username (remove @ if present)
    let normalizedUsername = username;
    if (normalizedUsername.startsWith('@')) {
      normalizedUsername = normalizedUsername.substring(1);
    }
    
    const sql = 'SELECT * FROM user_wallets WHERE username ILIKE $1';
    const result = await query(sql, [normalizedUsername]);
    
    if (result.rows.length > 0) {
      const wallet = result.rows[0];
      return {
        userId: wallet.user_id,
        accountId: wallet.account_id,
        privateKey: wallet.private_key,
        publicKey: wallet.public_key,
        evmAddress: wallet.evm_address,
        username: wallet.username,
        created: wallet.created_at
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting wallet by username:', error);
    return null;
  }
}

/**
 * Get wallet by account ID
 * @param {string} accountId - Hedera account ID
 * @returns {Promise<object|null>} Wallet object or null if not found
 */
async function getWalletByAccountId(accountId) {
  try {
    const sql = 'SELECT * FROM user_wallets WHERE account_id = $1';
    const result = await query(sql, [accountId]);
    
    if (result.rows.length > 0) {
      const wallet = result.rows[0];
      return {
        userId: wallet.user_id,
        accountId: wallet.account_id,
        privateKey: wallet.private_key,
        publicKey: wallet.public_key,
        evmAddress: wallet.evm_address,
        created: wallet.created_at
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting wallet by account ID:', error);
    return null;
  }
}

/**
 * Delete a wallet by user ID
 * @param {string} userId - Telegram user ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteWallet(userId) {
  try {
    const sql = 'DELETE FROM user_wallets WHERE user_id = $1 RETURNING id';
    const result = await query(sql, [userId]);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return false;
  }
}

/**
 * Get all wallets (for admin purposes)
 * @returns {Promise<Array<object>>} Array of wallet objects
 */
async function getAllWallets() {
  try {
    const sql = 'SELECT * FROM user_wallets ORDER BY created_at DESC';
    const result = await query(sql);
    
    return result.rows.map(wallet => ({
      userId: wallet.user_id,
      accountId: wallet.account_id,
      privateKey: wallet.private_key,
      publicKey: wallet.public_key,
      evmAddress: wallet.evm_address,
      created: wallet.created_at
    }));
  } catch (error) {
    console.error('Error getting all wallets:', error);
    return [];
  }
}

module.exports = {
  storeWallet,
  getWalletByUserId,
  getWalletByUsername,
  getWalletByAccountId,
  deleteWallet,
  getAllWallets,
};
