require('dotenv').config();
const mysql = require('mysql2/promise');
const initDB = require('./initDB');

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

// Call init AFTER connection
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✓ Database connected');

    // 🔥 Call initDB here
    await initDB();

    conn.release();
  } catch (err) {
    console.error('✗ DB connection failed:', err.message);
  }
})();

module.exports = pool;
