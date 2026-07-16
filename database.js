const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite Database connection error:', err.message);
  } else {
    console.log('Successfully connected to the SQLite database at:', dbPath);
  }
});

// Enable Foreign Key support in SQLite
db.run('PRAGMA foreign_keys = ON;', (err) => {
  if (err) {
    console.error('Error enabling foreign keys:', err.message);
  }
});

/**
 * Executes a query that doesn't return rows (e.g. INSERT, UPDATE, DELETE).
 * Returns { id: lastID, changes: number of rows affected }
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('Database run query failed:', sql, params, err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * Executes a query that returns a single row.
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Database get query failed:', sql, params, err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Executes a query that returns multiple rows.
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database all query failed:', sql, params, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Initializes the database schemas and migrations.
 */
async function initDatabase() {
  console.log('Initializing database tables...');
  try {
    // 1. Create Users Table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create Budgets Table
    await run(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        limit_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, category)
      )
    `);

    // 3. Create Transactions Table
    await run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        category TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        description TEXT,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables successfully initialized.');
  } catch (error) {
    console.error('Database initialization failed critical error:', error);
    process.exit(1);
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
