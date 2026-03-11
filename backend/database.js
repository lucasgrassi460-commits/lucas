const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    id_name TEXT,
    description TEXT,
    human_takeover BOOLEAN,
    split_messages BOOLEAN,
    instructions TEXT,
    active BOOLEAN DEFAULT 0,
    device_id TEXT,
    save_payments BOOLEAN DEFAULT 0
  )`);

  // Add device_id column if it doesn't exist (for existing databases)
  db.all(`PRAGMA table_info(bots)`, (err, rows) => {
    if (err) {
      console.error('Error checking table schema:', err);
      return;
    }
    const hasDeviceId = rows && rows.some(row => row.name === 'device_id');
    if (!hasDeviceId) {
      db.run(`ALTER TABLE bots ADD COLUMN device_id TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column name')) {
          console.error('Error adding device_id column:', alterErr);
        }
      });
    }
    const hasSavePayments = rows && rows.some(row => row.name === 'save_payments');
    if (!hasSavePayments) {
      db.run(`ALTER TABLE bots ADD COLUMN save_payments BOOLEAN DEFAULT 0`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column name')) {
          console.error('Error adding save_payments column:', alterErr);
        }
      });
    }
    const hasUserId = rows && rows.some(row => row.name === 'user_id');
    if (!hasUserId) {
      db.run(`ALTER TABLE bots ADD COLUMN user_id INTEGER`);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS bot_qa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER,
    question TEXT,
    answer TEXT,
    FOREIGN KEY(bot_id) REFERENCES bots(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    original_name TEXT,
    type TEXT,
    user_id INTEGER
  )`);
  
  // Add user_id if missing
  db.all(`PRAGMA table_info(documents)`, (err, rows) => {
    const hasUserId = rows && rows.some(row => row.name === 'user_id');
    if (!hasUserId) {
        db.run(`ALTER TABLE documents ADD COLUMN user_id INTEGER`);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS bot_documents (
    bot_id INTEGER,
    document_id INTEGER,
    FOREIGN KEY(bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY(bot_id, document_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ai_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    instructions TEXT,
    device_id TEXT,
    ai_provider TEXT DEFAULT 'gemini',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER
  )`);
  
  // Add ai_provider column if it doesn't exist
  db.all(`PRAGMA table_info(ai_agents)`, (err, rows) => {
    if (err) return;
    const hasProvider = rows && rows.some(row => row.name === 'ai_provider');
    if (!hasProvider) {
      db.run(`ALTER TABLE ai_agents ADD COLUMN ai_provider TEXT DEFAULT 'gemini'`, (alterErr) => {
        if (alterErr) console.error('Error adding ai_provider column:', alterErr);
      });
    }
    const hasUserId = rows && rows.some(row => row.name === 'user_id');
    if (!hasUserId) {
      db.run(`ALTER TABLE ai_agents ADD COLUMN user_id INTEGER`);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS ai_agent_documents (
    agent_id INTEGER,
    document_id INTEGER,
    FOREIGN KEY(agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY(agent_id, document_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversations INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0
  )`);

  db.get(`SELECT COUNT(*) as count FROM metrics`, (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO metrics (conversations, messages_received, messages_sent) VALUES (0, 0, 0)`);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT PRIMARY KEY,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    role TEXT,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(phone) REFERENCES conversations(phone) ON DELETE CASCADE
  )`);

  // --- SaaS / Auth ---
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    plan TEXT DEFAULT 'none',
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add SaaS columns if not exist
  db.all(`PRAGMA table_info(users)`, (err, rows) => {
    if (err) return;
    const hasName = rows && rows.some(row => row.name === 'name');
    if (!hasName) {
      db.run(`ALTER TABLE users ADD COLUMN name TEXT`);
    }
    const hasPlan = rows && rows.some(row => row.name === 'plan');
    if (!hasPlan) {
      db.run(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'none'`);
      db.run(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`);
      db.run(`ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive'`);
    }
  });
});

module.exports = db;
