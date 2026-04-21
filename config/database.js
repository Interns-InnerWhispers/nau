require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

// Test connection
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✓ Database connected successfully');
    conn.release();
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
  }
})();

module.exports = pool;
