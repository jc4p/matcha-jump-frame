import * as frame from '@farcaster/frame-sdk';

// API endpoint configuration
// const API_BASE_URL = process.env.NODE_ENV === 'production' 
//   ? 'https://matcha-jump-api.kasra.codes' 
//   : 'http://localhost:8787';
const API_BASE_URL = 'https://matcha-jump-api.kasra.codes'
// const API_BASE_URL = 'https://kasra-api.ngrok.app'

export class PaymentService {
  constructor() {
    this.paymentAddress = '0x0db12C0A67bc5B8942ea3126a465d7a0b23126C7'; // Replace with your payment address
    this.authToken = null;
    this.tokenExpiry = null;
    this.paymentsDisabled = false;
    this.clientFid = null;
    this.userFid = null;
    
    this.checkClientFid();
  }

  // Get auth token using Quick Auth
  async getAuthToken() {
    // For clientFid 399519, we don't need a JWT token
    if (this.clientFid === 399519) {
      return 'direct-fid-auth';
    }

    if (this.paymentsDisabled) {
      return null;
    }

    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.authToken;
      }

      // Get new token from Quick Auth
      const { token } = await frame.sdk.actions.quickAuth();
      this.authToken = token;
      
      // Set expiry to 55 minutes (tokens expire after 1 hour)
      this.tokenExpiry = Date.now() + (55 * 60 * 1000);
      
      return token;
    } catch (error) {
      console.error('Quick Auth failed:', error);
      return null; // Return null instead of throwing
    }
  }

  // Get headers for API requests
  async getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.clientFid === 399519 && this.userFid) {
      // Use direct FID authentication
      headers['X-User-FID'] = this.userFid.toString();
    } else {
      // Use JWT authentication
      const authToken = await this.getAuthToken();
      if (authToken && authToken !== 'direct-fid-auth') {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
    }

    return headers;
  }

  // Utility to convert ETH to Wei
  ethToWei(eth) {
    const wei = BigInt(Math.floor(eth * 1e18)).toString(16);
    return '0x' + wei;
  }

  // Ensure we're connected to the correct network
  async ensureCorrectNetwork() {
    try {
      // Determine target chain based on clientFid
      const targetChainId = this.clientFid === 399519 ? 8453 : 999; // Base for 399519, Hyper for others
      const targetChainHex = targetChainId === 8453 ? '0x2105' : '0x3e7';
      const chainName = targetChainId === 8453 ? 'Base' : 'Hyper';
      
      // Check current chain ID
      const chainId = await frame.sdk.wallet.ethProvider.request({
        method: 'eth_chainId'
      });
      
      const chainIdDecimal = typeof chainId === 'number' ? chainId : parseInt(chainId, 16);
      
      if (chainIdDecimal !== targetChainId) {
        console.log(`Switching from chain ${chainIdDecimal} to ${chainName} (${targetChainId})...`);
        
        // Switch to target chain
        await frame.sdk.wallet.ethProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainHex }]
        });
        
        console.log(`Successfully switched to ${chainName}`);
      } else {
        console.log(`Already connected to ${chainName}`);
      }
    } catch (error) {
      console.error('Failed to switch network:', error);
      const targetChain = this.clientFid === 399519 ? 'Base (chain ID 8453)' : 'Hyper (chain ID 999)';
      throw new Error(`Failed to switch to the required network: ${targetChain}`);
    }
  }

  // Make a payment through Frame SDK
  async makePayment(amount, description) {
    try {
      // Skip if payments are disabled (but not for clientFid 399519)
      if (this.paymentsDisabled && this.clientFid !== 399519) {
        console.log('Payment skipped - disabled for this client');
        // Return a mock transaction hash
        return '0x' + Math.random().toString(16).substr(2, 64);
      }

      // Ensure we're on the correct network before making any calls
      await this.ensureCorrectNetwork();
      
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
      const headers = await this.getHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/verify-payment`, {
        method: 'POST',
        headers,
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
    // If payments disabled (but not for clientFid 399519), return success without payment
    if (this.paymentsDisabled && this.clientFid !== 399519) {
      console.log('Continue payment skipped - disabled for this client');
      return {
        success: true,
        verified: true,
        data: {
          type: 'continue',
          score: currentScore,
          height: currentHeight
        }
      };
    }
    
    const prices = this.getPrices();
    const amount = prices.continue;
    const currency = this.clientFid === 399519 ? 'ETH' : 'HYPE';
    const txHash = await this.makePayment(amount, `Continue playing Matcha Jump (${amount} ${currency})`);
    
    const verification = await this.verifyPayment(txHash, 'continue', {
      score: currentScore,
      height: currentHeight,
      chain: this.clientFid === 399519 ? 'base' : 'hyper'
    });
    
    return verification;
  }

  // Purchase power-ups
  async purchasePowerUps(powerUpType, quantity = 1) {
    // If payments disabled (but not for clientFid 399519), return success without payment
    if (this.paymentsDisabled && this.clientFid !== 399519) {
      console.log('Power-up purchase skipped - disabled for this client');
      return {
        success: true,
        verified: true,
        data: {
          type: 'powerup',
          powerUpType,
          quantity
        }
      };
    }
    
    const prices = this.getPrices();
    const amount = prices.powerUps[powerUpType] * quantity;
    const currency = this.clientFid === 399519 ? 'ETH' : 'HYPE';
    const txHash = await this.makePayment(
      amount, 
      `Purchase ${quantity}x ${powerUpType} power-up (${amount} ${currency})`
    );
    
    const verification = await this.verifyPayment(txHash, 'powerup', {
      type: powerUpType,
      quantity,
      chain: this.clientFid === 399519 ? 'base' : 'hyper'
    });
    
    return verification;
  }

  // Get power-up prices
  getPrices() {
    // Different pricing for clientFid 399519 (Base chain)
    if (this.clientFid === 399519) {
      return {
        continue: 0.0005,
        powerUps: {
          rocket: 0.0006,
          shield: 0.0006,
          magnet: 0.0006,
          slowTime: 0.0006,
          bundle: 0.0015
        }
      };
    }
    
    // Default pricing for Hyper chain
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
  
  // Check if payments should be disabled for specific client
  async checkClientFid() {
    try {
      const context = await frame.sdk.context;
      this.clientFid = context.client?.clientFid;
      this.userFid = context.user?.fid;
      
      if (this.clientFid === 399519) {
        // Don't disable payments anymore - we'll use direct FID auth
        console.log('Client 399519 detected - will use direct FID authentication');
        console.log('User FID:', this.userFid);
      }
    } catch (e) {
      // Context not available
      console.error('Failed to get Frame context:', e);
    }
  }

  // Start a new game session
  async startGameSession() {
    try {
      const headers = await this.getHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/game/start`, {
        method: 'POST',
        headers
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
      const headers = await this.getHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/game/end`, {
        method: 'POST',
        headers,
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
      const headers = await this.getHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/powerups/inventory`, {
        headers
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
      const headers = await this.getHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/powerups/use`, {
        method: 'POST',
        headers,
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