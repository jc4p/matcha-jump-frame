import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient, Errors } from '@farcaster/quick-auth';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// Create Quick Auth client
const quickAuthClient = createClient();

// CORS middleware
app.use('*', cors({
  origin: ['https://matcha-jump.kasra.codes', 'http://localhost:3000', 'https://kasra.ngrok.app'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-FID']
}));

// JWT authentication middleware
async function authMiddleware(c, next) {
  // Check for X-User-FID header first (for clientFid 309857)
  const userFidHeader = c.req.header('X-User-FID');
  if (userFidHeader) {
    // Validate that this is a legitimate direct FID auth request
    // In production, you might want to add additional validation here
    const fid = parseInt(userFidHeader);
    if (!isNaN(fid) && fid > 0) {
      c.set('fid', fid.toString());
      c.set('address', null); // No address available with direct FID auth
      await next();
      return;
    }
  }

  // Standard JWT authentication
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No authorization token provided' }, 401);
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const payload = await quickAuthClient.verifyJwt({
      token,
      domain: c.env.QUICK_AUTH_DOMAIN
    });
    
    c.set('fid', payload.sub);
    c.set('address', payload.address);
    
    await next();
  } catch (error) {
    if (error instanceof Errors.InvalidTokenError) {
      return c.json({ error: 'Invalid token' }, 401);
    }
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

// Initialize viem client for Base or Hyper
function getViemClient(c, chain = 'hyper') {
  if (chain === 'base') {
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${c.env.ALCHEMY_API_KEY}`;
    return createPublicClient({
      chain: base,
      transport: http(alchemyUrl),
    });
  }
  
  // Default to Hyper chain
  return createPublicClient({
    chain: {
      id: 999,
      name: 'Hyper',
      network: 'hyper',
      nativeCurrency: {
        decimals: 18,
        name: 'HYPE',
        symbol: 'HYPE',
      },
      rpcUrls: {
        default: {
          http: [c.env.HYPER_RPC_URL],
        },
      },
    },
    transport: http(c.env.HYPER_RPC_URL),
  });
}

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Payment verification endpoint
app.post('/api/verify-payment', authMiddleware, async (c) => {
  try {
    const { txHash, type, metadata } = await c.req.json();
    console.log('verify-payment', txHash, type, metadata);

    const fid = c.get('fid');
    const chain = metadata?.chain || 'hyper'; // Default to hyper if not specified

    if (!txHash || !type || !metadata) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check if transaction already exists
    const existingTx = await c.env.DB.prepare(
      'SELECT * FROM transactions WHERE tx_hash = ?'
    ).bind(txHash).first();

    if (existingTx) {
      console.log('Transaction already processed', existingTx);
      return c.json({ error: 'Transaction already processed' }, 409);
    }

    // Verify transaction on-chain with retries
    const client = getViemClient(c, chain);
    let tx = null;
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        tx = await client.getTransactionReceipt({ hash: txHash });
        if (tx && tx.status === 'success') {
          // console.log('Transaction found and successful', tx);
          break; // Transaction found and successful
        }
      } catch (error) {
        console.log(`Attempt ${attempt} failed to fetch transaction:`, error.message);
      }

      if (attempt < maxRetries) {
        console.log(`Transaction not found on attempt ${attempt}, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!tx || !tx.status || tx.status !== 'success') {
      // console.log('Transaction not found or failed after multiple attempts', tx);
      return c.json({ error: 'Transaction not found or failed after multiple attempts' }, 402);
    }

    // Verify recipient
    // Broken on CBW?
    // if (tx.to?.toLowerCase() !== c.env.PAYMENT_ADDRESS.toLowerCase()) {
    //   console.log('Invalid payment address', tx.to, c.env.PAYMENT_ADDRESS);
    //   return c.json({ error: 'Invalid payment address' }, 402);
    // }

    // Calculate expected amount based on type and chain
    let expectedAmount;
    const isBase = chain === 'base';
    
    if (type === 'continue') {
      expectedAmount = parseEther(isBase ? '0.0005' : '0.001');
    } else if (type === 'powerup') {
      if (metadata.type === 'bundle') {
        expectedAmount = parseEther('0.0015'); // Same for both chains
      } else {
        expectedAmount = parseEther(isBase ? '0.0006' : '0.0005');
      }
    } else {
      console.log('Invalid payment type', type);
      return c.json({ error: 'Invalid payment type' }, 400);
    }
    

    // console.log('Expected amount', expectedAmount);

    // Verify amount (this is simplified - real implementation would check token transfers)
    // For now, we'll trust the transaction exists and is valid

    // Store transaction
    await c.env.DB.prepare(
      'INSERT INTO transactions (tx_hash, fid, type, amount, metadata) VALUES (?, ?, ?, ?, ?)'
    ).bind(txHash, fid, type, formatEther(expectedAmount), JSON.stringify(metadata)).run();

    // console.log('Transaction stored', txHash, fid, type, expectedAmount, metadata);

    // Update inventory if powerup purchase
    if (type === 'powerup') {
      // console.log('Updating inventory for powerup', metadata.type);
      if (metadata.type === 'bundle') {
        // Add 5 of each powerup
        await c.env.DB.prepare(`
          INSERT INTO powerup_inventory (fid, rocket, shield, magnet, slow_time)
          VALUES (?, 5, 5, 5, 5)
          ON CONFLICT(fid) DO UPDATE SET
            rocket = rocket + 5,
            shield = shield + 5,
            magnet = magnet + 5,
            slow_time = slow_time + 5,
            updated_at = unixepoch()
        `).bind(fid).run();
        // console.log('Inventory updated for bundle', fid);
      } else {
        // Add 5 of specific powerup
        const column = metadata.type.toLowerCase().replace('slowtime', 'slow_time');
        await c.env.DB.prepare(`
          INSERT INTO powerup_inventory (fid, ${column})
          VALUES (?, 5)
          ON CONFLICT(fid) DO UPDATE SET
            ${column} = ${column} + 5,
            updated_at = unixepoch()
        `).bind(fid).run();
        // console.log('Inventory updated for', column, fid);
      }
    }

    // console.log('Payment verified', txHash, fid, type, expectedAmount, metadata);

    return c.json({
      success: true,
      verified: true,
      data: {
        type,
        ...metadata
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get powerup inventory
app.get('/api/powerups/inventory', authMiddleware, async (c) => {
  try {
    const fid = c.get('fid');
    
    const inventory = await c.env.DB.prepare(
      'SELECT rocket, shield, magnet, slow_time FROM powerup_inventory WHERE fid = ?'
    ).bind(fid).first();

    if (!inventory) {
      // First time user - give them 1 of each power-up as a welcome bonus
      await c.env.DB.prepare(`
        INSERT INTO powerup_inventory (fid, rocket, shield, magnet, slow_time)
        VALUES (?, 1, 1, 1, 1)
      `).bind(fid).run();
      
      return c.json({
        rocket: 1,
        shield: 1,
        magnet: 1,
        slowTime: 1
      });
    }

    return c.json({
      rocket: inventory.rocket,
      shield: inventory.shield,
      magnet: inventory.magnet,
      slowTime: inventory.slow_time
    });

  } catch (error) {
    console.error('Inventory fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Use powerup
app.post('/api/powerups/use', authMiddleware, async (c) => {
  try {
    const { type, sessionId } = await c.req.json();
    const fid = c.get('fid');

    if (!type || !sessionId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const column = type.toLowerCase().replace('slowtime', 'slow_time');
    
    // Check inventory
    const inventory = await c.env.DB.prepare(
      `SELECT ${column} as count FROM powerup_inventory WHERE fid = ?`
    ).bind(fid).first();

    if (!inventory || inventory.count <= 0) {
      return c.json({ error: 'Insufficient powerups' }, 400);
    }

    // Decrement inventory
    await c.env.DB.prepare(
      `UPDATE powerup_inventory SET ${column} = ${column} - 1, updated_at = unixepoch() WHERE fid = ?`
    ).bind(fid).run();

    // Log usage
    await c.env.DB.prepare(
      'INSERT INTO powerup_usage (fid, session_id, powerup_type) VALUES (?, ?, ?)'
    ).bind(fid, sessionId, type).run();

    return c.json({ success: true, remaining: inventory.count - 1 });

  } catch (error) {
    console.error('Powerup usage error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Start game session
app.post('/api/game/start', authMiddleware, async (c) => {
  try {
    const fid = c.get('fid');
    const sessionId = uuidv4();

    await c.env.DB.prepare(
      'INSERT INTO game_sessions (id, fid) VALUES (?, ?)'
    ).bind(sessionId, fid).run();

    // Get current inventory
    const inventory = await c.env.DB.prepare(
      'SELECT rocket, shield, magnet, slow_time FROM powerup_inventory WHERE fid = ?'
    ).bind(fid).first();

    return c.json({
      sessionId,
      inventory: inventory ? {
        rocket: inventory.rocket,
        shield: inventory.shield,
        magnet: inventory.magnet,
        slowTime: inventory.slow_time
      } : {
        rocket: 0,
        shield: 0,
        magnet: 0,
        slowTime: 0
      }
    });

  } catch (error) {
    console.error('Game start error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// End game session
app.post('/api/game/end', authMiddleware, async (c) => {
  try {
    const { sessionId, score, height, powerupsUsed, coinsCollected } = await c.req.json();
    const fid = c.get('fid');

    if (!sessionId || score === undefined || height === undefined) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Update game session
    await c.env.DB.prepare(`
      UPDATE game_sessions 
      SET ended_at = unixepoch(), 
          score = ?, 
          height = ?, 
          powerups_used = ?, 
          coins_collected = ?,
          duration = unixepoch() - started_at
      WHERE id = ? AND fid = ?
    `).bind(score, height, JSON.stringify(powerupsUsed || {}), coinsCollected || 0, sessionId, fid).run();

    // Update user stats
    const stats = await c.env.DB.prepare(
      'SELECT high_score FROM user_stats WHERE fid = ?'
    ).bind(fid).first();

    if (!stats) {
      await c.env.DB.prepare(`
        INSERT INTO user_stats (fid, high_score, total_games) 
        VALUES (?, ?, 1)
      `).bind(fid, score).run();
    } else {
      await c.env.DB.prepare(`
        UPDATE user_stats 
        SET high_score = MAX(high_score, ?), 
            total_games = total_games + 1,
            updated_at = unixepoch()
        WHERE fid = ?
      `).bind(score, fid).run();
    }

    // Get player's global rank
    const finalScore = !stats || score > stats.high_score ? score : stats.high_score;
    const rankResult = await c.env.DB.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM user_stats
      WHERE high_score > ?
    `).bind(finalScore).first();

    return c.json({ 
      success: true,
      isNewHighScore: !stats || score > stats.high_score,
      globalRank: rankResult?.rank || 1
    });

  } catch (error) {
    console.error('Game end error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user stats
app.get('/api/stats/:fid', async (c) => {
  try {
    const fid = c.req.param('fid');
    
    const stats = await c.env.DB.prepare(
      'SELECT * FROM user_stats WHERE fid = ?'
    ).bind(fid).first();

    if (!stats) {
      return c.json({
        fid: parseInt(fid),
        highScore: 0,
        totalGames: 0,
        totalContinues: 0,
        powerupsPurchased: {},
        powerupsUsed: {}
      });
    }

    return c.json({
      fid: stats.fid,
      highScore: stats.high_score,
      totalGames: stats.total_games,
      totalContinues: stats.total_continues,
      powerupsPurchased: JSON.parse(stats.powerups_purchased || '{}'),
      powerupsUsed: JSON.parse(stats.powerups_used || '{}')
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get global leaderboard
app.get('/api/leaderboard', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get top scores
    const leaderboard = await c.env.DB.prepare(`
      SELECT 
        fid,
        high_score as score,
        total_games,
        updated_at
      FROM user_stats
      WHERE high_score > 0
      ORDER BY high_score DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    // Collect all FIDs to fetch user info
    const fids = leaderboard.results.map(entry => entry.fid).join(',');
    
    // Fetch user information from Neynar
    let userMap = {};
    if (fids) {
      try {
        const neynarResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids}`, {
          headers: {
            'x-api-key': c.env.NEYNAR_API_KEY
          }
        });
        
        if (neynarResponse.ok) {
          const neynarData = await neynarResponse.json();
          // Create a map of FID to user info
          neynarData.users.forEach(user => {
            userMap[user.fid] = {
              username: user.username,
              displayName: user.display_name,
              pfpUrl: user.pfp_url
            };
          });
        }
      } catch (error) {
        console.error('Failed to fetch Neynar data:', error);
        // Continue without user info if Neynar fails
      }
    }

    // Add rank and user info to each entry
    const rankedLeaderboard = leaderboard.results.map((entry, index) => ({
      rank: offset + index + 1,
      fid: entry.fid,
      score: entry.score,
      totalGames: entry.total_games,
      lastPlayed: entry.updated_at,
      username: userMap[entry.fid]?.username || null,
      displayName: userMap[entry.fid]?.displayName || null,
      pfpUrl: userMap[entry.fid]?.pfpUrl || null
    }));

    // Get authenticated user's rank if available
    let userRank = null;
    const authHeader = c.req.header('Authorization');
    const userFidHeader = c.req.header('X-User-FID');
    
    if (authHeader || userFidHeader) {
      try {
        let userFid;
        if (userFidHeader) {
          userFid = parseInt(userFidHeader);
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          const payload = await quickAuthClient.verifyJwt({
            token,
            domain: c.env.QUICK_AUTH_DOMAIN
          });
          userFid = parseInt(payload.sub);
        }

        if (userFid) {
          const userRankResult = await c.env.DB.prepare(`
            SELECT COUNT(*) + 1 as rank
            FROM user_stats
            WHERE high_score > (
              SELECT high_score FROM user_stats WHERE fid = ?
            )
          `).bind(userFid).first();
          
          userRank = userRankResult?.rank || null;
        }
      } catch (error) {
        // Silently fail - user rank is optional
        console.error('Error getting user rank:', error);
      }
    }

    return c.json({
      leaderboard: rankedLeaderboard,
      total: leaderboard.results.length,
      userRank
    });

  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
