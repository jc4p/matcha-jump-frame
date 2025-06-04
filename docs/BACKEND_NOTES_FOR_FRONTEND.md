# Backend Notes for Frontend Integration

## API Base URL
- Development: `http://localhost:8787`
- Production: `https://matcha-jump-api.kasra.codes`

## Authentication Requirements

### Getting the JWT Token
All API endpoints (except `/health` and `/api/stats/{fid}`) require authentication using Farcaster Quick Auth:

```javascript
import { sdk } from '@farcaster/frame-sdk';

// Get JWT token
const { token } = await sdk.experimental.quickAuth();

// Store token in state/memory for the session
setAuthToken(token);
```

### Using the JWT Token
Include the JWT token in the Authorization header for all authenticated requests:

```javascript
const response = await fetch(`${API_BASE_URL}/api/game/start`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## Important Implementation Details

### 1. Game Session Flow
The backend expects this exact flow:
1. Call `/api/game/start` when starting a new game - returns `sessionId` and current inventory
2. Use the `sessionId` for all power-up usage during the game
3. Call `/api/game/end` with the final stats when game ends

### 2. Payment Verification
- The backend verifies transactions on the Base blockchain
- Transaction hash must be sent immediately after payment
- Each transaction can only be used once (replay protection)
- Payment amounts are verified on-chain

### 3. Power-up Inventory
- Inventory is stored per user (FID)
- Each power-up purchase gives 3 uses
- Bundle purchase gives 3 of each power-up type
- Inventory persists across sessions

### 4. Error Handling
The API returns consistent error responses:
```javascript
{
  "error": "Error message here"
}
```

Status codes:
- 400: Bad request (missing/invalid data)
- 401: Authentication failed
- 402: Payment verification failed
- 409: Transaction already used
- 500: Server error

### 5. CORS Configuration
The API is configured to accept requests from:
- `https://matcha-jump.kasra.codes`
- `http://localhost:3000`

Update these in the backend if your frontend URL changes.

## API Endpoint Reference

### Authenticated Endpoints (require JWT)

#### POST /api/game/start
Start a new game session.

Response:
```json
{
  "sessionId": "uuid-here",
  "inventory": {
    "rocket": 3,
    "shield": 1,
    "magnet": 0,
    "slowTime": 2
  }
}
```

#### POST /api/game/end
End game session and save stats.

Request:
```json
{
  "sessionId": "uuid-from-start",
  "score": 12345,
  "height": 5000,
  "powerupsUsed": {
    "rocket": 1,
    "shield": 0
  },
  "coinsCollected": 150
}
```

Response:
```json
{
  "success": true,
  "isNewHighScore": true
}
```

#### POST /api/verify-payment
Verify blockchain payment.

Request:
```json
{
  "txHash": "0x...",
  "type": "continue" | "powerup",
  "metadata": {
    // For continue:
    "score": 12345,
    "height": 5000,
    
    // For powerup:
    "type": "rocket" | "shield" | "magnet" | "slowTime" | "bundle",
    "quantity": 1
  }
}
```

#### GET /api/powerups/inventory
Get current power-up inventory.

Response:
```json
{
  "rocket": 3,
  "shield": 1,
  "magnet": 0,
  "slowTime": 2
}
```

#### POST /api/powerups/use
Use a power-up during gameplay.

Request:
```json
{
  "type": "rocket",
  "sessionId": "uuid-from-start"
}
```

### Public Endpoints (no auth required)

#### GET /api/stats/{fid}
Get user statistics by FID.

Response:
```json
{
  "fid": 6841,
  "highScore": 12345,
  "totalGames": 42,
  "totalContinues": 5,
  "powerupsPurchased": {},
  "powerupsUsed": {}
}
```

## Common Integration Issues

1. **Token Expiry**: JWT tokens expire after 1 hour. Handle token refresh in your frontend.

2. **Session Management**: Always use the sessionId from `/api/game/start` for that game session.

3. **Inventory Sync**: Fetch inventory at game start and after each purchase to stay in sync.

4. **Transaction Timing**: Submit payment verification immediately after blockchain confirmation to prevent issues.

5. **Power-up Names**: Frontend uses camelCase (slowTime) but backend converts to snake_case internally.

## Testing Tips

1. Use the `/health` endpoint to verify the API is running
2. Test authentication with a simple inventory fetch first
3. Use local development server with `bun run dev` for testing
4. Check browser console for CORS errors
5. Verify JWT token is being sent in headers

## Future Considerations

The backend is prepared for:
- Leaderboard endpoints (global and friends)
- Analytics tracking
- Additional power-up types
- Social features
- Achievement system

These endpoints are not yet implemented but the database schema supports them.