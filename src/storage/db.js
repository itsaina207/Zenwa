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