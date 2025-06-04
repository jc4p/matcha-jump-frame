# Backend Implementation Guide for Frontend Integration

## Overview
This guide explains how to integrate the real backend API with the frontend game once the backend is deployed. Currently, the game uses mock payment verification that simulates a 2-second delay.

## Current Mock Implementation

The game currently has a `PaymentService` that mocks the backend behavior:
- Located in `/src/services/PaymentService.js`
- Uses Frame SDK to make ETH transactions
- Mocks the verification with a 2-second delay
- Returns success for all payments in development mode

## Integration Steps

### 1. Update API Base URL
In `PaymentService.js`, update the `API_BASE_URL`:
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.matcha-jump.com'  // Replace with actual backend URL
  : 'http://localhost:8787';
```

### 2. Add Authentication
When the backend implements Quick Auth verification, update the verification calls:
```javascript
async verifyPayment(txHash, type, metadata = {}) {
  // Get auth token from Quick Auth
  const authToken = await this.getAuthToken(); // Implement this
  
  const response = await fetch(`${API_BASE_URL}/api/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      txHash,
      type,
      metadata
    })
  });
}
```

### 3. Implement Quick Auth Integration
Add Quick Auth to get user's FID:
```javascript
import { sdk } from '@farcaster/frame-sdk';

async getAuthToken() {
  try {
    const { token } = await sdk.experimental.quickAuth();
    return token;
  } catch (error) {
    console.error('Quick Auth failed:', error);
    throw new Error('Authentication required');
  }
}
```

### 4. Update Payment Flow

#### For Continue Payment:
1. User clicks "Continue" button
2. Frame SDK prompts wallet transaction
3. Get transaction hash
4. Send to backend for verification
5. Backend verifies on-chain and returns success
6. Game continues from safe position

#### For Power-up Purchase:
1. User clicks "Buy" on specific power-up
2. Frame SDK prompts wallet transaction
3. Get transaction hash
4. Send to backend with power-up type
5. Backend verifies amount matches power-up price
6. Add power-ups to inventory on success

### 5. Error Handling Improvements
Replace the mock error handling with real error cases:
```javascript
async verifyPayment(txHash, type, metadata = {}) {
  try {
    const response = await fetch(...);
    
    if (!response.ok) {
      switch (response.status) {
        case 402:
          throw new Error('Payment verification failed');
        case 409:
          throw new Error('Transaction already used');
        case 401:
          throw new Error('Authentication required');
        default:
          throw new Error('Payment processing failed');
      }
    }
    
    return await response.json();
  } catch (error) {
    // Show user-friendly error messages
    this.handlePaymentError(error);
    throw error;
  }
}
```

### 6. Add Transaction Status Polling
For better UX, poll transaction status:
```javascript
async waitForTransactionConfirmation(txHash) {
  const maxAttempts = 30; // 30 seconds timeout
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await fetch(`${API_BASE_URL}/api/transaction/${txHash}`);
    const data = await response.json();
    
    if (data.confirmed) {
      return data;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  throw new Error('Transaction timeout');
}
```

### 7. Update HYPE Token Integration
If using HYPE token instead of native ETH:
```javascript
async makePayment(amount, description) {
  // Update to use HYPE token contract
  const hypeTokenAddress = '0x...'; // Add actual HYPE token address
  
  // Encode transfer function call
  const transferData = this.encodeTransferData(
    this.paymentAddress,
    amount
  );
  
  const txHash = await frame.sdk.wallet.ethProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: hypeTokenAddress,
      data: transferData,
      value: '0x0' // No ETH value for token transfer
    }]
  });
}
```

### 8. Implement Power-up Inventory Syncing

#### Load Inventory on Game Start:
```javascript
// In Game.js init() method
async loadPowerUpInventory() {
  try {
    const authToken = await this.getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/powerups/inventory`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    this.powerUpInventory = data.inventory;
  } catch (error) {
    console.error('Failed to load inventory:', error);
    // Use local storage as fallback
  }
}

// Start game session
async startGameSession() {
  try {
    const authToken = await this.getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/game/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    this.gameSessionId = data.sessionId;
    this.powerUpInventory = data.inventory;
  } catch (error) {
    console.error('Failed to start session:', error);
  }
}
```

#### Track Power-up Usage:
```javascript
// In Game.js usePowerUp() method
async trackPowerUpUsage(type) {
  try {
    const authToken = await this.getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/powerups/use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type,
        gameSessionId: this.gameSessionId
      })
    });
    
    const data = await response.json();
    // Update local inventory with server response
    this.powerUpInventory = data.inventory;
  } catch (error) {
    console.error('Failed to track power-up usage:', error);
  }
}

// Modify existing usePowerUp method
usePowerUp() {
  if (!this.availablePowerUp || this.gameState !== 'playing') return;
  
  // ... existing code ...
  
  // Track usage on backend
  this.trackPowerUpUsage(this.availablePowerUp);
}
```

#### End Game Session:
```javascript
// In gameOver() method
async endGameSession() {
  if (!this.gameSessionId) return;
  
  try {
    const authToken = await this.getAuthToken();
    await fetch(`${API_BASE_URL}/api/game/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        sessionId: this.gameSessionId,
        score: this.baseHeightScore + this.score,
        height: Math.abs(this.camera.y),
        powerUpsUsed: this.powerUpsUsedThisGame, // Track this during gameplay
        coinsCollected: this.coinsCollectedThisGame,
        duration: (Date.now() - this.gameStartTime) / 1000
      })
    });
  } catch (error) {
    console.error('Failed to end game session:', error);
  }
}
```

#### Sync After Power-up Purchase:
```javascript
// In processPowerUpPurchase() after verification
async processPowerUpPurchase(type) {
  try {
    this.paymentState = 'processing';
    
    // Make payment
    const result = await paymentService.purchasePowerUps(type, 1);
    
    this.paymentState = 'verifying';
    
    // After successful verification, the backend should have updated inventory
    // Reload inventory from server to ensure sync
    await this.loadPowerUpInventory();
    
    this.paymentModal = null;
    this.paymentState = null;
    eventBus.emit(Events.HAPTIC_TRIGGER, 'success');
    
  } catch (error) {
    console.error('Power-up purchase failed:', error);
  }
}
```

### 9. Add Leaderboard Integration
Once backend supports leaderboards:
```javascript
// In Game.js
async submitScore(score, height) {
  try {
    const authToken = await this.getAuthToken();
    await fetch(`${API_BASE_URL}/api/leaderboard/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ score, height })
    });
  } catch (error) {
    console.error('Failed to submit score:', error);
  }
}
```

### 10. Add Analytics Events
Track important events for analytics:
```javascript
// Add to PaymentService
async trackEvent(eventName, data) {
  try {
    await fetch(`${API_BASE_URL}/api/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventName,
        data,
        timestamp: Date.now()
      })
    });
  } catch (error) {
    // Don't block on analytics failures
    console.warn('Analytics failed:', error);
  }
}

// Usage
this.trackEvent('payment_initiated', { type: 'continue', amount: 0.001 });
this.trackEvent('payment_completed', { type: 'powerup', txHash });
```

### 10. Testing Integration
1. Set up local backend instance
2. Update frontend to use localhost backend
3. Test all payment flows with testnet
4. Verify error handling works correctly
5. Check authentication flow
6. Test with slow/failed transactions

## Remaining Frontend Work

### High Priority:
1. ✅ Payment verification integration (mocked, ready for real backend)
2. ✅ Quick Auth setup (Frame SDK ready)
3. ⏳ Leaderboard UI (waiting for backend)
4. ⏳ User stats display (waiting for backend)

### Medium Priority:
1. ⏳ Social sharing features
2. ⏳ Achievement system UI
3. ⏳ Friend challenges
4. ✅ Difficulty progression (implemented)

### Low Priority:
1. ⏳ Additional platform types
2. ⏳ Enemy/obstacle system
3. ⏳ Daily challenges UI
4. ⏳ NFT rewards display

## Environment Setup
Create `.env` file for production:
```env
VITE_API_URL=https://api.matcha-jump.com
VITE_PAYMENT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f5b1E1
VITE_HYPE_TOKEN_ADDRESS=0x...
VITE_CHAIN_ID=8453
```

## Deployment Checklist
- [ ] Update API URLs to production
- [ ] Set up proper CORS headers
- [ ] Enable HTTPS everywhere
- [ ] Test payment flow on mainnet
- [ ] Monitor error rates
- [ ] Set up alerts for failed payments
- [ ] Regular testing of payment flow