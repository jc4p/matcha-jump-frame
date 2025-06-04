# Matcha Jump API

## Setup Instructions

### 1. Create D1 Database
```bash
wrangler d1 create matcha-jump-db
```

Copy the database ID from the output and update `wrangler.toml` with the actual ID.

### 2. Apply Database Schema
```bash
wrangler d1 execute matcha-jump-db --local --file=./schema.sql
```

For production:
```bash
wrangler d1 execute matcha-jump-db --remote --file=./schema.sql
```

### 3. Run Development Server
```bash
bun run dev
```

### 4. Deploy to Production
```bash
bun run deploy
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/verify-payment` - Verify blockchain payment (requires auth)
- `GET /api/powerups/inventory` - Get user's powerup inventory (requires auth)
- `POST /api/powerups/use` - Use a powerup (requires auth)
- `POST /api/game/start` - Start a new game session (requires auth)
- `POST /api/game/end` - End game session and save stats (requires auth)
- `GET /api/stats/{fid}` - Get user statistics

## Authentication

All authenticated endpoints require a JWT token from Farcaster Quick Auth in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

## Environment Variables

Update the values in `wrangler.toml` as needed:
- `BASE_RPC_URL` - Base blockchain RPC URL
- `PAYMENT_ADDRESS` - Address to receive payments
- `HYPE_TOKEN_ADDRESS` - HYPE token contract address
- `QUICK_AUTH_DOMAIN` - Your app domain for Farcaster auth