# Backend Requirements for Matcha Jump

## Overview
This document outlines the backend API requirements for the Matcha Jump game's payment and monetization features. The backend should be built using Hono framework and deployed on a separate domain/port from the game frontend.

## API Endpoints Required

### 1. Payment Verification Endpoint
**POST** `/api/verify-payment`

Verifies blockchain transactions for in-game purchases.

#### Request Body:
```json
{
  "txHash": "0x...",  // Transaction hash from blockchain
  "type": "continue" | "powerup",  // Type of purchase
  "metadata": {
    // For "continue" type:
    "score": 12345,
    "height": 5000,
    
    // For "powerup" type:
    "type": "rocket" | "shield" | "magnet" | "slowTime" | "bundle",
    "quantity": 1
  }
}
```

#### Response:
```json
{
  "success": true,
  "verified": true,
  "data": {
    "type": "continue",
    // Echo back the metadata
    "score": 12345,
    "height": 5000
  }
}
```

#### Implementation Requirements:
1. Verify the transaction hash exists on Base blockchain
2. Confirm the transaction is to the correct payment address
3. Verify the amount matches expected price:
   - Continue: 0.001 HYPE
   - Individual power-ups: 0.0005 HYPE
   - Bundle: 0.0015 HYPE
4. Check transaction hasn't been used before (prevent replay)
5. Store transaction in database for record keeping

### 2. Leaderboard Endpoints (Future)
**POST** `/api/leaderboard/submit`
```json
{
  "fid": 12345,  // Farcaster ID
  "score": 98765,
  "height": 15000,
  "authToken": "jwt-from-quickauth"
}
```

**GET** `/api/leaderboard/global?limit=100`
**GET** `/api/leaderboard/friends?fid=12345&limit=50`

### 3. Power-up Inventory Endpoints
**GET** `/api/powerups/inventory`

Gets the current power-up inventory for the authenticated user.

#### Headers:
```
Authorization: Bearer {jwt-from-quickauth}
```

#### Response:
```json
{
  "inventory": {
    "rocket": 5,
    "shield": 3,
    "magnet": 7,
    "slowTime": 2
  },
  "lastUpdated": "2025-01-06T12:00:00Z"
}
```

**POST** `/api/powerups/use`

Records power-up usage to maintain accurate inventory.

#### Request Body:
```json
{
  "type": "rocket" | "shield" | "magnet" | "slowTime",
  "gameSessionId": "uuid-v4"  // To track usage per game
}
```

#### Response:
```json
{
  "success": true,
  "remainingCount": 4,
  "inventory": {
    "rocket": 4,
    "shield": 3,
    "magnet": 7,
    "slowTime": 2
  }
}
```

### 4. Game Session Endpoints
**POST** `/api/game/start`

Creates a new game session and returns current inventory.

#### Response:
```json
{
  "sessionId": "uuid-v4",
  "inventory": {
    "rocket": 5,
    "shield": 3,
    "magnet": 7,
    "slowTime": 2
  }
}
```

**POST** `/api/game/end`

Records game stats and final score.

#### Request Body:
```json
{
  "sessionId": "uuid-v4",
  "score": 12345,
  "height": 5000,
  "powerUpsUsed": {
    "rocket": 1,
    "shield": 0,
    "magnet": 2,
    "slowTime": 0
  },
  "coinsCollected": 234,
  "duration": 180  // seconds
}
```

### 5. User Stats Endpoint
**GET** `/api/stats/{fid}`
```json
{
  "fid": 12345,
  "highScore": 98765,
  "totalGamesPlayed": 234,
  "totalContinues": 5,
  "powerUpsPurchased": {
    "rocket": 15,
    "shield": 12,
    "magnet": 8,
    "slowTime": 6
  },
  "powerUpsUsed": {
    "rocket": 12,
    "shield": 10,
    "magnet": 6,
    "slowTime": 4
  },
  "currentInventory": {
    "rocket": 3,
    "shield": 2,
    "magnet": 2,
    "slowTime": 2
  }
}
```

## Technical Requirements

### CORS Configuration
- Allow origin from game domain (frame.matcha-jump.com or similar)
- Allow credentials for authenticated requests
- Proper preflight handling for POST requests

### Authentication
- Integrate with Farcaster Quick Auth for user verification
- JWT validation using `@farcaster/quick-auth` package
- Store user FID with all transactions

### Database Schema
```sql
-- Transactions table
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  fid INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User stats table  
CREATE TABLE user_stats (
  fid INTEGER PRIMARY KEY,
  high_score INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  total_continues INTEGER DEFAULT 0,
  powerups_purchased JSONB DEFAULT '{}',
  powerups_used JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Power-up inventory table
CREATE TABLE powerup_inventory (
  fid INTEGER PRIMARY KEY,
  rocket INTEGER DEFAULT 0,
  shield INTEGER DEFAULT 0,
  magnet INTEGER DEFAULT 0,
  slow_time INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game sessions table
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid INTEGER NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  score INTEGER,
  height INTEGER,
  powerups_used JSONB,
  coins_collected INTEGER,
  duration INTEGER
);

-- Power-up usage log
CREATE TABLE powerup_usage (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL,
  session_id UUID REFERENCES game_sessions(id),
  powerup_type VARCHAR(20) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_transactions_fid ON transactions(fid);
CREATE INDEX idx_game_sessions_fid ON game_sessions(fid);
CREATE INDEX idx_powerup_usage_fid ON powerup_usage(fid);
CREATE INDEX idx_powerup_usage_session ON powerup_usage(session_id);
```

### Blockchain Integration
- Use viem or ethers.js to interact with Base blockchain
- RPC endpoint for Base mainnet
- ABI for HYPE token contract (if needed)
- Monitor transaction confirmations (wait for 2-3 blocks)

### Error Handling
Return appropriate HTTP status codes:
- 400: Invalid request data
- 401: Authentication failed
- 402: Payment verification failed
- 409: Transaction already used
- 500: Server error

### Rate Limiting
- Implement rate limiting per FID
- Max 10 payment verifications per minute
- Max 100 API calls per minute per user

## Environment Variables
```env
DATABASE_URL=postgresql://...
BASE_RPC_URL=https://mainnet.base.org
PAYMENT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f5b1E1
HYPE_TOKEN_ADDRESS=0x...
QUICK_AUTH_DOMAIN=matcha-jump.com
NODE_ENV=production
```

## Cloudflare D1 Database Considerations

Since this will be deployed on Cloudflare Workers with D1:

### D1 Specific Schema Adjustments
```sql
-- D1 uses SQLite, so we need to adjust our schema
-- Remove SERIAL and use INTEGER PRIMARY KEY for auto-increment
-- Remove UUID type and use TEXT for UUIDs
-- Use TEXT for JSON data instead of JSONB

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
```

### D1 Migration File
```sql
-- migrations/0001_initial_schema.sql
-- Run with: wrangler d1 migrations apply matcha-jump-db

-- Create all tables
-- (Include all CREATE TABLE statements from above)

-- Create indexes
CREATE INDEX idx_transactions_fid ON transactions(fid);
CREATE INDEX idx_game_sessions_fid ON game_sessions(fid);
CREATE INDEX idx_powerup_usage_fid ON powerup_usage(fid);
CREATE INDEX idx_powerup_usage_session ON powerup_usage(session_id);

-- Create composite indexes for common queries
CREATE INDEX idx_transactions_fid_created ON transactions(fid, created_at);
CREATE INDEX idx_sessions_fid_score ON game_sessions(fid, score);
```

### Hono + D1 Integration Example
```typescript
// In your Hono app
import { Hono } from 'hono';
import { D1Database } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  PAYMENT_ADDRESS: string;
  BASE_RPC_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

// Example query
app.get('/api/powerups/inventory', async (c) => {
  const fid = c.get('fid'); // From auth middleware
  
  const result = await c.env.DB.prepare(
    'SELECT rocket, shield, magnet, slow_time FROM powerup_inventory WHERE fid = ?'
  ).bind(fid).first();
  
  return c.json({
    inventory: result || { rocket: 0, shield: 0, magnet: 0, slowTime: 0 }
  });
});
```

### D1 Performance Considerations
1. **Batch Operations**: Use `batch()` for multiple related queries
2. **Prepared Statements**: Always use parameterized queries
3. **Indexes**: Create indexes for all foreign keys and common query patterns
4. **JSON Handling**: Parse JSON fields after retrieval
5. **Timestamp Storage**: Use Unix timestamps (INTEGER) for better performance

### Cloudflare KV for Caching
Consider using KV for frequently accessed data:
```typescript
// Cache leaderboard in KV
await c.env.CACHE.put('leaderboard:global', JSON.stringify(leaderboard), {
  expirationTtl: 300 // 5 minutes
});
```

## Deployment Considerations
- Deploy on Cloudflare Workers (api.matcha-jump.com)
- Use wrangler.toml for configuration
- Set up D1 database bindings
- Configure custom domains
- Use Cloudflare Analytics for monitoring
- Set up Logpush for detailed logging
- Use Durable Objects for real-time features (future)

## Security Considerations
1. Never trust client-submitted payment data
2. Always verify on-chain
3. Implement request signing if needed
4. Store minimal user data
5. Regular security audits
6. Use parameterized queries to prevent SQL injection