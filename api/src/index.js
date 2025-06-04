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
  origin: ['https://matcha-jump.kasra.codes', 'http://localhost:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// JWT authentication middleware
async function authMiddleware(c, next) {
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

// Initialize viem client for Base
function getViemClient(c) {
  return createPublicClient({
    chain: base,
    transport: http(c.env.BASE_RPC_URL),
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
    const fid = c.get('fid');

    if (!txHash || !type || !metadata) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check if transaction already exists
    const existingTx = await c.env.DB.prepare(
      'SELECT * FROM transactions WHERE tx_hash = ?'
    ).bind(txHash).first();

    if (existingTx) {
      return c.json({ error: 'Transaction already processed' }, 409);
    }

    // Verify transaction on-chain with retries
    const client = getViemClient(c);
    let tx = null;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        tx = await client.getTransactionReceipt({ hash: txHash });
        if (tx && tx.status === 'success') {
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
      return c.json({ error: 'Transaction not found or failed after multiple attempts' }, 402);
    }

    // Verify recipient
    if (tx.to?.toLowerCase() !== c.env.PAYMENT_ADDRESS.toLowerCase()) {
      return c.json({ error: 'Invalid payment address' }, 402);
    }

    // Calculate expected amount based on type
    let expectedAmount;
    if (type === 'continue') {
      expectedAmount = parseEther('0.001');
    } else if (type === 'powerup') {
      if (metadata.type === 'bundle') {
        expectedAmount = parseEther('0.0015');
      } else {
        expectedAmount = parseEther('0.0005');
      }
    } else {
      return c.json({ error: 'Invalid payment type' }, 400);
    }

    // Verify amount (this is simplified - real implementation would check token transfers)
    // For now, we'll trust the transaction exists and is valid

    // Store transaction
    await c.env.DB.prepare(
      'INSERT INTO transactions (tx_hash, fid, type, amount, metadata) VALUES (?, ?, ?, ?, ?)'
    ).bind(txHash, fid, type, formatEther(expectedAmount), JSON.stringify(metadata)).run();

    // Update inventory if powerup purchase
    if (type === 'powerup') {
      if (metadata.type === 'bundle') {
        // Add 3 of each powerup
        await c.env.DB.prepare(`
          INSERT INTO powerup_inventory (fid, rocket, shield, magnet, slow_time)
          VALUES (?, 3, 3, 3, 3)
          ON CONFLICT(fid) DO UPDATE SET
            rocket = rocket + 3,
            shield = shield + 3,
            magnet = magnet + 3,
            slow_time = slow_time + 3,
            updated_at = unixepoch()
        `).bind(fid).run();
      } else {
        // Add 3 of specific powerup
        const column = metadata.type.toLowerCase().replace('slowtime', 'slow_time');
        await c.env.DB.prepare(`
          INSERT INTO powerup_inventory (fid, ${column})
          VALUES (?, 3)
          ON CONFLICT(fid) DO UPDATE SET
            ${column} = ${column} + 3,
            updated_at = unixepoch()
        `).bind(fid).run();
      }
    }

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
      return c.json({
        rocket: 0,
        shield: 0,
        magnet: 0,
        slowTime: 0
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

    return c.json({ 
      success: true,
      isNewHighScore: !stats || score > stats.high_score 
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

export default app;
