const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.env.DB_PATH || './data', 'janusbot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_number INTEGER DEFAULT 1,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    room_name TEXT,
    motion1 TEXT NOT NULL,
    motion2 TEXT NOT NULL,
    motion3 TEXT NOT NULL,
    infoslide1 TEXT,
    infoslide2 TEXT,
    infoslide3 TEXT,
    gov_ranking TEXT,
    opp_ranking TEXT,
    gov_veto TEXT,
    opp_veto TEXT,
    gov_discord_id TEXT,
    opp_discord_id TEXT,
    status TEXT DEFAULT 'pending',
    started_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('Database schema created with columns:', db.prepare("PRAGMA table_info(rounds)").all().map(c => c.name));

module.exports = db;