import * as frame from '@farcaster/frame-sdk';

// Mock API endpoint - replace with your actual Hono API URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.your-domain.com' 
  : 'http://localhost:8787';

export class PaymentService {
  constructor() {
    this.paymentAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5b1E1'; // Replace with your payment address
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
      const response = await fetch(`${API_BASE_URL}/api/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          txHash,
          type, // 'continue' or 'powerup'
          metadata
        })
      });

      if (!response.ok) {
        throw new Error('Payment verification failed');
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
}

export const paymentService = new PaymentService();