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
    active BOOLEAN DEFAULT 0
  )`);

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
    type TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bot_documents (
    bot_id INTEGER,
    document_id INTEGER,
    FOREIGN KEY(bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY(bot_id, document_id)
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
});

module.exports = db;
