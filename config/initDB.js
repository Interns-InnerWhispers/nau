require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runSqlFile(connection, filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await connection.query(sql);
    console.log("✓ SQL executed successfully");
  } catch (err) {
    console.error("✗ Error executing SQL file:", err);
  }
}

async function initDB() {
  const schemaPath = path.join(__dirname, 'schema.sql');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    const dbName = process.env.DB_NAME;

    console.log(`Initializing database: ${dbName}`);

    // Create DB if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    // Check tables
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ?
    `, [dbName]);

    if (tables.length === 0) {
      console.log("No tables → applying schema...");
      await runSqlFile(connection, schemaPath);
    } else {
      console.log("Tables exist → skipping schema");
    }

    console.log("✓ Database ready");
  } catch (error) {
    console.error("✗ DB init failed:", error);
  } finally {
    await connection.end();
  }
}

initDB();
