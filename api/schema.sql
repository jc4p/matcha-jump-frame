-- Transactions table
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE NOT NULL,
  fid INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  metadata TEXT, -- JSON stored as TEXT
  created_at INTEGER DEFAULT (unixepoch())
);

-- User stats table  
CREATE TABLE user_stats (
  fid INTEGER PRIMARY KEY,
  high_score INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  total_continues INTEGER DEFAULT 0,
  powerups_purchased TEXT DEFAULT '{}', -- JSON as TEXT
  powerups_used TEXT DEFAULT '{}', -- JSON as TEXT
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Power-up inventory table
CREATE TABLE powerup_inventory (
  fid INTEGER PRIMARY KEY,
  rocket INTEGER DEFAULT 0,
  shield INTEGER DEFAULT 0,
  magnet INTEGER DEFAULT 0,
  slow_time INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Game sessions table
CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY, -- UUID as TEXT
  fid INTEGER NOT NULL,
  started_at INTEGER DEFAULT (unixepoch()),
  ended_at INTEGER,
  score INTEGER,
  height INTEGER,
  powerups_used TEXT, -- JSON as TEXT
  coins_collected INTEGER,
  duration INTEGER
);

-- Power-up usage log
CREATE TABLE powerup_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER NOT NULL,
  session_id TEXT REFERENCES game_sessions(id),
  powerup_type TEXT NOT NULL,
  used_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX idx_transactions_fid ON transactions(fid);
CREATE INDEX idx_game_sessions_fid ON game_sessions(fid);
CREATE INDEX idx_powerup_usage_fid ON powerup_usage(fid);
CREATE INDEX idx_powerup_usage_session ON powerup_usage(session_id);