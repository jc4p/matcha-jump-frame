import * as frame from '@farcaster/frame-sdk';
import { GameEngine } from './engine/GameEngine.js';
import { Camera } from './engine/Camera.js';
import { Player } from './entities/Player.js';
import { Platform } from './entities/Platform.js';
import { Coin } from './entities/Coin.js';
import { PowerUp } from './entities/PowerUp.js';
import { eventBus, Events } from './eventBus.js';
import { AssetLoader } from './utils/AssetLoader.js';
import { ParticleManager } from './managers/ParticleManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { PowerUpManager } from './managers/PowerUpManager.js';
import { ComboManager } from './managers/ComboManager.js';

export class Game extends GameEngine {
  constructor(canvas) {
    super(canvas);
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.player = null;
    this.platforms = [];
    this.coins = [];
    this.powerUps = [];
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.gameState = 'loading';
    this.frameContext = null;
    
    this.platformSpawnY = 0;
    this.platformSpacing = 80;
    this.showTouchHint = true;
    this.touchHintTimer = 0;
    
    this.assetLoader = new AssetLoader();
    this.assetsLoaded = false;
    this.particleManager = new ParticleManager();
    this.audioManager = new AudioManager();
    this.powerUpManager = new PowerUpManager();
    this.comboManager = new ComboManager();
    
    this.init();
  }
  
  async init() {
    // Start loading screen animation
    this.startLoadingAnimation();
    
    // Load all game assets
    const assetsToLoad = [
      { key: 'player', src: '/images/player.png' },
      { key: 'platform_normal', src: '/images/plate_rectangle_1.png' },
      { key: 'platform_moving', src: '/images/plate_rectangle_2.png' },
      { key: 'platform_breakable', src: '/images/plate_rectangle_3.png' },
      { key: 'platform_spring', src: '/images/plate_circle.png' }
    ];
    
    const loadSuccess = await this.assetLoader.loadAll(assetsToLoad);
    
    if (!loadSuccess) {
      console.error('Failed to load some assets, but continuing anyway');
    }
    
    this.assetsLoaded = true;
    
    try {
      this.frameContext = await frame.sdk.context;
      eventBus.emit(Events.FRAME_AUTH, this.frameContext);
    } catch (e) {
      console.log('Not in frame context');
    }
    
    this.setupGameEventListeners();
    this.showMenu();
    
    frame.sdk.actions.ready();
    eventBus.emit(Events.FRAME_READY);
  }
  
  startLoadingAnimation() {
    const animate = () => {
      if (this.gameState === 'loading') {
        this.renderLoading();
        requestAnimationFrame(animate);
      }
    };
    animate();
  }
  
  setupGameEventListeners() {
    this.canvas.addEventListener('click', () => {
      // Resume audio context on user interaction
      this.audioManager.resumeContext();
      
      if (this.gameState === 'menu' || this.gameState === 'gameOver') {
        this.startGame();
      }
    });
    
    this.canvas.addEventListener('touchstart', (e) => {
      // Resume audio context on user interaction
      this.audioManager.resumeContext();
      
      if (this.gameState === 'menu' || this.gameState === 'gameOver') {
        e.preventDefault();
        this.startGame();
      }
    });
    
    eventBus.on(Events.SCORE_UPDATE, (score) => {
      this.score = score;
      if (score > this.highScore) {
        this.highScore = score;
        this.saveHighScore(score);
        eventBus.emit(Events.HIGH_SCORE, this.highScore);
      }
    });
    
    eventBus.on(Events.COIN_COLLECTED, (coin) => {
      const multiplier = this.powerUpManager.getScoreMultiplier();
      this.score += coin.value * multiplier;
      eventBus.emit(Events.SCORE_UPDATE, this.score);
      // Add particle effect for coin collection
      this.particleManager.createCoinParticles(coin.x, coin.y);
    });
    
    // Combo events
    eventBus.on(Events.COMBO_MILESTONE, (data) => {
      // Add special effects for combo milestones
      if (this.player) {
        this.particleManager.createComboParticles(this.player.x, this.player.y);
      }
    });
    
    // Update score from combo bonuses
    eventBus.on(Events.SCORE_UPDATE, (points) => {
      if (typeof points === 'number' && !isNaN(points)) {
        this.score += points;
      }
    });
    
    // Haptic feedback for Frame
    eventBus.on(Events.HAPTIC_TRIGGER, async (type) => {
      try {
        if (type === 'light') {
          await frame.sdk.actions.hapticFeedback.impactOccurred('light');
        } else if (type === 'heavy') {
          await frame.sdk.actions.hapticFeedback.impactOccurred('heavy');
        }
      } catch (e) {
        // Haptics not available
      }
    });
    
  }
  
  showMenu() {
    this.gameState = 'menu';
    this.isRunning = false;
    this.render();
  }
  
  startGame() {
    this.gameState = 'playing';
    this.score = 0;
    this.showTouchHint = true;
    this.touchHintTimer = 3; // Show hint for 3 seconds
    
    // Clear existing game objects
    this.gameObjects = [];
    this.platforms = [];
    this.coins = [];
    this.powerUps = [];
    
    // Clear power-ups and combo
    this.powerUpManager.clearAllPowerUps();
    this.comboManager.reset();
    
    // Add particle manager to game objects
    this.addGameObject(this.particleManager);
    
    // Create initial platforms first
    this.createInitialPlatforms();
    
    // Create player on the first platform
    const firstPlatform = this.platforms[0];
    this.player = new Player(firstPlatform.x, firstPlatform.y - 40, this.assetLoader);
    this.addGameObject(this.player);
    
    // Give small initial jump to start the game
    setTimeout(() => {
      if (this.player && this.gameState === 'playing') {
        this.player.jump();
      }
    }, 100);
    
    // Reset camera to start at player position
    this.camera = new Camera(this.width, this.height);
    this.camera.y = this.player.y - this.height / 2;
    this.camera.follow(this.player);
    
    // Start the engine
    this.start();
  }
  
  createInitialPlatforms() {
    const startY = this.height - 100;
    
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * (this.width - 70) + 35;
      const y = startY - (i * this.platformSpacing);
      const platform = new Platform(x, y, 'normal', this.assetLoader);
      this.platforms.push(platform);
      this.addGameObject(platform);
    }
    
    this.platformSpawnY = startY - (10 * this.platformSpacing);
  }
  
  update(deltaTime) {
    if (this.gameState === 'playing') {
      // Call parent update
      super.update(deltaTime);
      
      // Update camera
      this.camera.update();
      
      // Update combo manager
      this.comboManager.update(deltaTime);
      
      // Update touch hint timer
      if (this.touchHintTimer > 0) {
        this.touchHintTimer -= deltaTime;
        if (this.touchHintTimer <= 0) {
          this.showTouchHint = false;
        }
      }
      
      // Game-specific updates
      this.checkCollisions();
      this.spawnPlatforms();
      this.cleanupPlatforms();
      this.cleanupCoins();
      this.cleanupPowerUps();
      this.handlePowerUpEffects();
      
      // Check if player fell below the camera view
      if (this.player) {
        // Only check for game over after a few frames to let physics settle
        if (this.lastTime > 100 && this.player.y > this.camera.y + this.height + 50) {
          this.gameOver();
        }
      }
      
      // Update score with multiplier
      const multiplier = this.powerUpManager.getScoreMultiplier();
      const baseScore = Math.max(0, Math.floor(-this.camera.y / 10));
      const currentScore = baseScore * multiplier;
      if (currentScore > this.score) {
        this.score = currentScore;
        eventBus.emit(Events.SCORE_UPDATE, currentScore);
      }
    }
  }
  
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    
    // Background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.gameState === 'loading') {
      this.renderLoading();
    } else if (this.gameState === 'menu') {
      this.renderMenu(ctx);
    } else if (this.gameState === 'gameOver') {
      this.renderGameOver(ctx);
    } else if (this.gameState === 'playing') {
      // Apply camera transform
      this.camera.applyTransform(ctx);
      
      // Render game objects in view
      for (const obj of this.gameObjects) {
        if (obj.render && this.camera.isInView(obj)) {
          obj.render(ctx);
        }
      }
      
      // Restore transform
      this.camera.restoreTransform(ctx);
      
      // Render UI
      this.renderUI(ctx);
    }
  }
  
  renderLoading() {
    const ctx = this.ctx;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Matcha Jump', this.width / 2, this.height / 3);
    
    // Loading bar
    const barWidth = 300;
    const barHeight = 20;
    const barX = (this.width - barWidth) / 2;
    const barY = this.height / 2;
    
    // Background
    ctx.fillStyle = '#ddd';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Progress
    const progress = this.assetLoader.getProgress();
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    
    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Loading text
    ctx.font = '20px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('Loading assets...', this.width / 2, barY + 50);
  }
  
  renderMenu(ctx) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Matcha Jump', this.width / 2, this.height / 3);
    
    ctx.font = '24px Arial';
    ctx.fillText('Tap to Start', this.width / 2, this.height / 2);
    
    if (this.highScore > 0) {
      ctx.font = '20px Arial';
      ctx.fillText(`High Score: ${this.highScore}`, this.width / 2, this.height * 0.7);
    }
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', this.width / 2, this.height / 3);
    
    ctx.font = '32px Arial';
    ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2);
    
    ctx.font = '24px Arial';
    ctx.fillText(`High Score: ${this.highScore}`, this.width / 2, this.height * 0.6);
    
    ctx.font = '20px Arial';
    ctx.fillText('Tap to Play Again', this.width / 2, this.height * 0.75);
  }
  
  renderUI(ctx) {
    // Score
    ctx.fillStyle = '#333';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 20, 40);
    
    // Combo display
    const combo = this.comboManager.getCombo();
    if (combo > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`Combo: ${combo}x`, 20, 65);
    }
    
    // Active power-ups
    const activePowerUps = this.powerUpManager.getActivePowerUps();
    let powerUpY = combo > 0 ? 95 : 70;
    
    for (const powerUp of activePowerUps) {
      ctx.fillStyle = powerUp.properties.color;
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'left';
      
      let text = `${powerUp.properties.icon} ${powerUp.properties.name}`;
      if (powerUp.remainingTime > 0) {
        const seconds = Math.ceil(powerUp.remainingTime / 1000);
        text += ` (${seconds}s)`;
      }
      
      ctx.fillText(text, 20, powerUpY);
      powerUpY += 25;
    }
    
    // Mobile touch controls hint - just text that fades out
    if ('ontouchstart' in window && this.showTouchHint) {
      const alpha = Math.min(1, this.touchHintTimer);
      
      // Simple text instruction
      ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`;
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Touch left or right side to move', this.width / 2, this.height - 40);
    }
  }
  
  checkCollisions() {
    if (!this.player) return;
    
    const playerBounds = this.player.getBounds();
    
    // Check platform collisions
    if (this.player.velocityY > 0) {
      for (const platform of this.platforms) {
        if (platform.isDestroyed) continue;
        
        const platformBounds = platform.getBounds();
        
        if (playerBounds.bottom > platformBounds.top &&
            playerBounds.bottom < platformBounds.bottom &&
            playerBounds.right > platformBounds.left &&
            playerBounds.left < platformBounds.right) {
          
          this.player.y = platformBounds.top - this.player.height / 2;
          
          // Spring platforms give super jump
          if (platform.type === 'spring') {
            this.player.jump(-800); // Super jump!
            eventBus.emit(Events.HAPTIC_TRIGGER, 'heavy');
            eventBus.emit(Events.PLAYER_SPRING);
          } else {
            this.player.jump();
            eventBus.emit(Events.HAPTIC_TRIGGER, 'light');
          }
          
          this.player.land();
          platform.onPlayerLand();
          break;
        }
      }
    }
    
    // Check coin collisions (with magnet effect)
    const magnetRadius = this.powerUpManager.isActive('magnet') ? 150 : 0;
    
    for (const coin of this.coins) {
      if (coin.collected) continue;
      
      const coinBounds = coin.getBounds();
      const distance = Math.sqrt(
        Math.pow(this.player.x - coin.x, 2) + 
        Math.pow(this.player.y - coin.y, 2)
      );
      
      // Magnet attraction
      if (magnetRadius > 0 && distance < magnetRadius) {
        const attraction = 1 - (distance / magnetRadius);
        coin.x += (this.player.x - coin.x) * attraction * 0.1;
        coin.y += (this.player.y - coin.y) * attraction * 0.1;
      }
      
      if (playerBounds.right > coinBounds.left &&
          playerBounds.left < coinBounds.right &&
          playerBounds.bottom > coinBounds.top &&
          playerBounds.top < coinBounds.bottom) {
        
        coin.collect();
      }
    }
    
    // Check power-up collisions
    for (const powerUp of this.powerUps) {
      if (powerUp.collected) continue;
      
      const powerUpBounds = powerUp.getBounds();
      
      if (playerBounds.right > powerUpBounds.left &&
          playerBounds.left < powerUpBounds.right &&
          playerBounds.bottom > powerUpBounds.top &&
          playerBounds.top < powerUpBounds.bottom) {
        
        powerUp.collect();
      }
    }
  }
  
  spawnPlatforms() {
    while (this.platformSpawnY > this.camera.y - this.height) {
      const x = Math.random() * (this.width - 70) + 35;
      const y = this.platformSpawnY;
      
      let type = 'normal';
      const rand = Math.random();
      if (rand < 0.1) {
        type = 'moving';
      } else if (rand < 0.15) {
        type = 'breakable';
      } else if (rand < 0.18) {
        type = 'spring';
      }
      
      const platform = new Platform(x, y, type, this.assetLoader);
      this.platforms.push(platform);
      this.addGameObject(platform);
      
      // Randomly spawn coins on platforms (20% chance)
      if (Math.random() < 0.2 && type !== 'breakable') {
        const coin = new Coin(x, y - 30);
        this.coins.push(coin);
        this.addGameObject(coin);
      }
      
      // Randomly spawn power-ups (5% chance)
      if (Math.random() < 0.05 && type !== 'breakable') {
        const powerUpTypes = ['rocket', 'shield', 'magnet', 'scoreBoost'];
        const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        const powerUp = new PowerUp(x, y - 50, randomType);
        this.powerUps.push(powerUp);
        this.addGameObject(powerUp);
      }
      
      this.platformSpawnY -= this.platformSpacing;
    }
  }
  
  cleanupPlatforms() {
    this.platforms = this.platforms.filter(platform => {
      if (platform.y > this.camera.y + this.height + 100 || platform.isDestroyed) {
        this.removeGameObject(platform);
        return false;
      }
      return true;
    });
  }
  
  cleanupCoins() {
    this.coins = this.coins.filter(coin => {
      if (coin.y > this.camera.y + this.height + 100 || coin.collected) {
        this.removeGameObject(coin);
        return false;
      }
      return true;
    });
  }
  
  cleanupPowerUps() {
    this.powerUps = this.powerUps.filter(powerUp => {
      if (powerUp.y > this.camera.y + this.height + 100 || powerUp.collected) {
        this.removeGameObject(powerUp);
        return false;
      }
      return true;
    });
  }
  
  handlePowerUpEffects() {
    // Rocket boost effect
    if (this.powerUpManager.isActive('rocket') && this.player) {
      this.player.velocityY = Math.min(this.player.velocityY, -600);
      
      // Add rocket particles
      this.particleManager.createRocketParticles(this.player.x, this.player.y + this.player.height / 2);
    }
    
    // Shield effect - check for fall protection
    if (this.player && this.player.y > this.camera.y + this.height / 2 && 
        this.player.velocityY > 0 && this.powerUpManager.useShield()) {
      // Bounce player back up
      this.player.velocityY = -800;
      this.player.jump(-800);
      eventBus.emit(Events.HAPTIC_TRIGGER, 'heavy');
      
      // Shield break effect
      this.particleManager.createShieldBreakParticles(this.player.x, this.player.y);
    }
  }
  
  gameOver() {
    this.gameState = 'gameOver';
    this.pause();
    eventBus.emit(Events.GAME_OVER);
    eventBus.emit(Events.HAPTIC_TRIGGER, 'heavy');
  }
  
  loadHighScore() {
    try {
      const saved = localStorage.getItem('matchaJumpHighScore');
      return saved ? parseInt(saved) : 0;
    } catch (e) {
      console.error('Failed to load high score:', e);
      return 0;
    }
  }
  
  saveHighScore(score) {
    try {
      localStorage.setItem('matchaJumpHighScore', score.toString());
    } catch (e) {
      console.error('Failed to save high score:', e);
    }
  }
}