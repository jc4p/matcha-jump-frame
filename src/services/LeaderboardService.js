import * as frame from '@farcaster/frame-sdk';

class LeaderboardService {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'https://matcha-jump-api.kasra.codes';
    this.frameContext = null;
    this.authHeader = null;
  }

  async init() {
    try {
      const context = await frame.context();
      this.frameContext = context;
      
      // Handle different authentication methods
      if (context?.user?.fid === 399519) {
        // Direct FID authentication
        this.authHeader = { 'X-User-FID': context.user.fid.toString() };
      } else if (context?.client?.clientFid === 399519) {
        // Check for direct FID from client
        this.authHeader = { 'X-User-FID': context.user.fid.toString() };
      } else {
        // Try to get JWT token
        try {
          const token = await frame.actions.authenticate({
            claims: {
              sub: context?.user?.fid?.toString() || '0',
              address: context?.user?.addresses?.[0] || '0x0',
            },
          });
          this.authHeader = { 'Authorization': `Bearer ${token}` };
        } catch (err) {
          console.error('Authentication failed:', err);
          // Proceed without authentication - will still get leaderboard but no user rank
          this.authHeader = null;
        }
      }
    } catch (err) {
      console.error('Frame context error:', err);
      // Proceed without authentication
      this.authHeader = null;
    }
  }

  async getLeaderboard(limit = 20, offset = 0) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(this.authHeader || {})
      };

      const response = await fetch(`${this.baseUrl}/api/leaderboard?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      throw error;
    }
  }

  async getUserRank() {
    // This is included in the leaderboard response if authenticated
    const data = await this.getLeaderboard(1);
    return data.userRank;
  }
}

export const leaderboardService = new LeaderboardService();