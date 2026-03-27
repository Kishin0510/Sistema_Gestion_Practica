'use strict';

/**
 * Database initialisation script
 * Uses Railway MySQL environment variables (MYSQL*) to connect via the
 * mysql2 package and execute db/script.sql before each deployment.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const {
  MYSQLHOST,
  MYSQLPORT = '3306',
  MYSQLUSER,
  MYSQLPASSWORD,
  MYSQLDATABASE,
} = process.env;

const missing = ['MYSQLHOST', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE']
  .filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Error: missing required environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}

const SQL_FILE = path.join(__dirname, '..', 'db', 'script.sql');

if (!fs.existsSync(SQL_FILE)) {
  console.error(`Error: SQL file not found at ${SQL_FILE}`);
  process.exit(1);
}

async function main() {
  console.log(`Initialising database '${MYSQLDATABASE}' on ${MYSQLHOST}:${MYSQLPORT}...`);

  const connection = await mysql.createConnection({
    host: MYSQLHOST,
    port: Number(MYSQLPORT),
    user: MYSQLUSER,
    password: MYSQLPASSWORD,
    database: MYSQLDATABASE,
    multipleStatements: true,
  });

  try {
    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    await connection.query(sql);
    console.log('Database initialisation complete.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Database initialisation failed:', err.message);
  process.exit(1);
});
