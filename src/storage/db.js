/**
 * Database connection module
 */
const { Pool } = require('pg');

// Create a connection pool using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Recommended settings for Replit's PostgreSQL service
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the database connection on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database');
    
    // Créer la table pour les airdrops si elle n'existe pas déjà
    await client.query(`
      CREATE TABLE IF NOT EXISTS airdrops (
        id SERIAL PRIMARY KEY,
        creator_id TEXT NOT NULL,
        token_id TEXT NOT NULL,
        token_name TEXT,
        transaction_id TEXT NOT NULL,
        pending_airdrop_id TEXT,
        total_amount BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE'
      )
    `);
    
    // Créer la table pour les destinataires d'airdrop si elle n'existe pas déjà
    await client.query(`
      CREATE TABLE IF NOT EXISTS airdrop_recipients (
        id SERIAL PRIMARY KEY,
        airdrop_id INTEGER REFERENCES airdrops(id),
        recipient_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        amount BIGINT NOT NULL,
        claimed BOOLEAN DEFAULT FALSE,
        claimed_at TIMESTAMP
      )
    `);
    
    console.log('Database tables initialized successfully');
    client.release();
  } catch (err) {
    console.error('Error connecting to database:', err);
  }
})();

/**
 * Execute a SQL query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, params) {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 500) {
      console.log('Long query execution time:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

module.exports = {
  query,
  pool,
};