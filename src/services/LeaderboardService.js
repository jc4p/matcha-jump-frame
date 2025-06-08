class LeaderboardService {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'https://matcha-jump-api.kasra.codes';
    this.frameContext = null;
    this.authHeader = null;
  }

  async getLeaderboard(limit = 20, offset = 0) {
    try {
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