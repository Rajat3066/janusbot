const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.env.DB_PATH || './data', 'janusbot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    motion1 TEXT NOT NULL,
    motion2 TEXT NOT NULL,
    motion3 TEXT NOT NULL,
    gov_ranking TEXT,
    opp_ranking TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;