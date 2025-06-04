import * as frame from '@farcaster/frame-sdk';

// API endpoint configuration
// const API_BASE_URL = process.env.NODE_ENV === 'production' 
//   ? 'https://matcha-jump-api.kasra.codes' 
//   : 'http://localhost:8787';
const API_BASE_URL = 'https://matcha-jump-api.kasra.codes'

export class PaymentService {
  constructor() {
    this.paymentAddress = '0x0db12C0A67bc5B8942ea3126a465d7a0b23126C7'; // Replace with your payment address
    this.authToken = null;
    this.tokenExpiry = null;
  }

  // Get auth token using Quick Auth
  async getAuthToken() {
    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.authToken;
      }

      // Get new token from Quick Auth
      const { token } = await frame.sdk.experimental.quickAuth();
      this.authToken = token;
      
      // Set expiry to 55 minutes (tokens expire after 1 hour)
      this.tokenExpiry = Date.now() + (55 * 60 * 1000);
      
      return token;
    } catch (error) {
      console.error('Quick Auth failed:', error);
      throw new Error('Authentication required');
    }
  }

  // Utility to convert ETH to Wei
  ethToWei(eth) {
    const wei = BigInt(Math.floor(eth * 1e18)).toString(16);
    return '0x' + wei;
  }

  // Make a payment through Frame SDK
  async makePayment(amount, description) {
    try {
      // Get user's wallet address
      const accounts = await frame.sdk.wallet.ethProvider.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || !accounts[0]) {
        throw new Error('No wallet connected');
      }

      // Convert ETH to Wei
      const weiValue = this.ethToWei(amount);
      
      // Send transaction
      const txHash = await frame.sdk.wallet.ethProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: this.paymentAddress,
          value: weiValue
        }]
      });
      
      return txHash;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }

  // Verify payment on backend
  async verifyPayment(txHash, type, metadata = {}) {
    try {
      const authToken = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/api/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          txHash,
          type, // 'continue' or 'powerup'
          metadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        switch (response.status) {
          case 402:
            throw new Error('Payment verification failed');
          case 409:
            throw new Error('Transaction already used');
          case 401:
            // Token might be expired, clear it and retry once
            this.authToken = null;
            this.tokenExpiry = null;
            throw new Error('Authentication failed');
          default:
            throw new Error(errorData.error || 'Payment processing failed');
        }
      }

      return await response.json();
    } catch (error) {
      console.error('Verification failed:', error);
      // For development, mock a successful response after a delay
      if (process.env.NODE_ENV !== 'production') {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              verified: true,
              data: {
                type,
                ...metadata
              }
            });
          }, 2000); // Simulate network delay
        });
      }
      throw error;
    }
  }

  // Pay to continue playing
  async payContinue(currentScore, currentHeight) {
    const amount = 0.001; // 0.001 HYPE
    const txHash = await this.makePayment(amount, 'Continue playing Matcha Jump');
    
    const verification = await this.verifyPayment(txHash, 'continue', {
      score: currentScore,
      height: currentHeight
    });
    
    return verification;
  }

  // Purchase power-ups
  async purchasePowerUps(powerUpType, quantity = 1) {
    const prices = {
      rocket: 0.0005,
      shield: 0.0005,
      magnet: 0.0005,
      slowTime: 0.0005,
      bundle: 0.0015 // All 4 power-ups
    };

    const amount = prices[powerUpType] * quantity;
    const txHash = await this.makePayment(
      amount, 
      `Purchase ${quantity}x ${powerUpType} power-up`
    );
    
    const verification = await this.verifyPayment(txHash, 'powerup', {
      type: powerUpType,
      quantity
    });
    
    return verification;
  }

  // Get power-up prices
  getPrices() {
    return {
      continue: 0.001,
      powerUps: {
        rocket: 0.0005,
        shield: 0.0005,
        magnet: 0.0005,
        slowTime: 0.0005,
        bundle: 0.0015
      }
    };
  }

  // Start a new game session
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

      if (!response.ok) {
        throw new Error('Failed to start game session');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to start game session:', error);
      // For development, return mock data
      if (process.env.NODE_ENV !== 'production') {
        return {
          sessionId: 'mock-session-' + Date.now(),
          inventory: {
            rocket: 3,
            shield: 3,
            magnet: 3,
            slowTime: 3
          }
        };
      }
      throw error;
    }
  }

  // End game session and submit stats
  async endGameSession(sessionId, stats) {
    try {
      const authToken = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/api/game/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sessionId,
          score: stats.score,
          height: stats.height,
          powerupsUsed: stats.powerupsUsed || {},
          coinsCollected: stats.coinsCollected || 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to end game session');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to end game session:', error);
      // For development, return mock data
      if (process.env.NODE_ENV !== 'production') {
        return {
          success: true,
          isNewHighScore: stats.score > 10000
        };
      }
      throw error;
    }
  }

  // Get current power-up inventory
  async getInventory() {
    try {
      const authToken = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/api/powerups/inventory`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get inventory');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get inventory:', error);
      // For development, return mock data
      if (process.env.NODE_ENV !== 'production') {
        return {
          rocket: 3,
          shield: 3,
          magnet: 3,
          slowTime: 3
        };
      }
      throw error;
    }
  }

  // Use a power-up during gameplay
  async usePowerUp(type, sessionId) {
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
          sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to use power-up');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to use power-up:', error);
      // For development, just return success
      if (process.env.NODE_ENV !== 'production') {
        return { success: true };
      }
      throw error;
    }
  }
}

export const paymentService = new PaymentService();