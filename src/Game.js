import * as frame from '@farcaster/frame-sdk';
import { GameEngine } from './engine/GameEngine.js';
import { Camera } from './engine/Camera.js';
import { Player } from './entities/Player.js';
import { Platform } from './entities/Platform.js';
import { eventBus, Events } from './eventBus.js';

export class Game extends GameEngine {
  constructor(canvas) {
    super(canvas);
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.player = null;
    this.platforms = [];
    this.score = 0;
    this.highScore = 0;
    this.gameState = 'menu';
    this.frameContext = null;
    
    this.platformSpawnY = 0;
    this.platformSpacing = 80;
    this.showTouchHint = true;
    this.touchHintTimer = 0;
    
    this.init();
  }
  
  async init() {
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
  
  setupGameEventListeners() {
    this.canvas.addEventListener('click', () => {
      if (this.gameState === 'menu' || this.gameState === 'gameOver') {
        this.startGame();
      }
    });
    
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.gameState === 'menu' || this.gameState === 'gameOver') {
        e.preventDefault();
        this.startGame();
      }
    });
    
    eventBus.on(Events.SCORE_UPDATE, (score) => {
      this.score = score;
      if (score > this.highScore) {
        this.highScore = score;
        eventBus.emit(Events.HIGH_SCORE, this.highScore);
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
    
    // Create initial platforms first
    this.createInitialPlatforms();
    
    // Create player on the first platform
    const firstPlatform = this.platforms[0];
    this.player = new Player(firstPlatform.x, firstPlatform.y - 40);
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
      const platform = new Platform(x, y, 'normal');
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
      
      // Check if player fell below the camera view
      if (this.player) {
        // Only check for game over after a few frames to let physics settle
        if (this.lastTime > 100 && this.player.y > this.camera.y + this.height + 50) {
          this.gameOver();
        }
      }
      
      // Update score
      const currentScore = Math.max(0, Math.floor(-this.camera.y / 10));
      if (currentScore > this.score) {
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
    
    if (this.gameState === 'menu') {
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
    if (!this.player || this.player.velocityY <= 0) return;
    
    const playerBounds = this.player.getBounds();
    
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
        } else {
          this.player.jump();
        }
        
        this.player.land();
        platform.onPlayerLand();
        
        eventBus.emit(Events.HAPTIC_TRIGGER, 'light');
        break;
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
      
      const platform = new Platform(x, y, type);
      this.platforms.push(platform);
      this.addGameObject(platform);
      
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
  
  gameOver() {
    this.gameState = 'gameOver';
    this.pause();
    eventBus.emit(Events.GAME_OVER);
    eventBus.emit(Events.HAPTIC_TRIGGER, 'heavy');
  }
}