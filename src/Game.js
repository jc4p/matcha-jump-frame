import * as frame from '@farcaster/frame-sdk';
import { GameEngine } from './engine/GameEngine.js';
import { Camera } from './engine/Camera.js';
import { Player } from './entities/Player.js';
import { Platform } from './entities/Platform.js';
import { Coin } from './entities/Coin.js';
import { PowerUp } from './entities/PowerUp.js';
import { Particle } from './entities/Particle.js';
import { eventBus, Events } from './eventBus.js';
import { AssetLoader } from './utils/AssetLoader.js';
import { ParticleManager } from './managers/ParticleManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { PowerUpManager } from './managers/PowerUpManager.js';
import { ComboManager } from './managers/ComboManager.js';
import { BackgroundManager } from './managers/BackgroundManager.js';
import { paymentService } from './services/PaymentService.js';
import { hapticsService } from './services/HapticsService.js';

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
    
    // Menu state
    this.menuState = 'main'; // 'main', 'powerups', 'pre-game'
    this.selectedPowerUp = null;
    
    // Menu animation
    this.menuPlayerY = 0;
    this.menuPlayerVelocity = 0;
    this.menuPlayerTime = 0;
    
    // Power-up inventory (3 of each for now)
    this.powerUpInventory = {
      rocket: 3,
      shield: 3,
      magnet: 3,
      slowTime: 3
    };
    
    // Available power-up in game (selected from menu)
    this.availablePowerUp = null;
    
    this.platformSpawnY = 0;
    this.basePlatformSpacing = 80;
    this.platformSpacing = this.basePlatformSpacing;
    this.showTouchHint = true;
    this.touchHintTimer = 0;
    
    // Difficulty progression
    this.difficultyLevel = 0;
    this.heightMilestone = 0;
    
    this.assetLoader = new AssetLoader();
    this.assetsLoaded = false;
    this.particleManager = new ParticleManager();
    this.audioManager = new AudioManager();
    this.powerUpManager = new PowerUpManager();
    this.comboManager = new ComboManager();
    this.backgroundManager = new BackgroundManager(window.innerWidth, window.innerHeight);
    
    // Payment state
    this.paymentState = null; // null, 'processing', 'verifying'
    this.paymentModal = null; // 'continue', 'powerups'
    
    // Game session tracking
    this.gameSessionId = null;
    this.gameStartTime = null;
    this.powerUpsUsedThisGame = {};
    this.coinsCollectedThisGame = 0;
    
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
    this.canvas.addEventListener('click', (e) => {
      // Resume audio context on user interaction
      this.audioManager.resumeContext();
      
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (this.gameState === 'menu') {
        this.handleMenuClick(x, y);
      } else if (this.gameState === 'gameOver') {
        this.handleGameOverClick(x, y);
      }
    });
    
    this.canvas.addEventListener('touchstart', (e) => {
      // Resume audio context on user interaction
      this.audioManager.resumeContext();
      
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      if (this.gameState === 'menu') {
        this.handleMenuClick(x, y);
      } else if (this.gameState === 'gameOver') {
        this.handleGameOverClick(x, y);
      } else if (this.gameState === 'playing') {
        // Double tap to use power-up
        const now = Date.now();
        if (!this.lastTapTime) this.lastTapTime = 0;
        
        if (now - this.lastTapTime < 300) { // Double tap within 300ms
          this.usePowerUp();
        }
        this.lastTapTime = now;
      }
    });
    
    eventBus.on(Events.COIN_COLLECTED, (coin) => {
      const multiplier = this.powerUpManager.getScoreMultiplier();
      const comboMultiplier = this.comboManager.getMultiplier();
      this.score += coin.value * multiplier * comboMultiplier;
      this.coinsCollectedThisGame++;
      hapticsService.collectCoin();
    });
    
    // Handle combo bonus points
    eventBus.on(Events.COMBO_MILESTONE, (data) => {
      if (data.bonus) {
        this.score += data.bonus;
        hapticsService.comboMilestone();
      }
    });
    
    // Haptic feedback - now supports both Frame SDK and Vibration API
    eventBus.on(Events.HAPTIC_TRIGGER, async (type) => {
      await hapticsService.trigger(type);
    });
    
    // Keyboard controls for power-up
    window.addEventListener('keydown', (e) => {
      if (this.gameState === 'playing' && e.code === 'Space') {
        e.preventDefault();
        this.usePowerUp();
      }
    });
    
  }
  
  async showMenu() {
    this.gameState = 'menu';
    this.menuState = 'main';
    this.selectedPowerUp = null;
    this.isRunning = false;
    
    // Load inventory from backend
    try {
      const inventory = await paymentService.getInventory();
      this.powerUpInventory = inventory;
    } catch (error) {
      console.error('Failed to load inventory:', error);
      // Use existing inventory if backend fails
    }
    
    this.startMenuAnimation();
  }
  
  startMenuAnimation() {
    const animate = () => {
      if (this.gameState === 'menu') {
        this.render();
        requestAnimationFrame(animate);
      }
    };
    animate();
  }
  
  async startGame() {
    this.gameState = 'playing';
    this.score = 0;
    this.baseHeightScore = 0;
    this.showTouchHint = true;
    this.touchHintTimer = 3; // Show hint for 3 seconds
    // Don't reset availablePowerUp here - it's set in startGameWithPowerUp
    
    // Reset game stats tracking
    this.gameStartTime = Date.now();
    this.powerUpsUsedThisGame = {};
    this.coinsCollectedThisGame = 0;
    
    // Start game session with backend
    try {
      const session = await paymentService.startGameSession();
      this.gameSessionId = session.sessionId;
      
      // Update inventory from backend
      if (session.inventory) {
        this.powerUpInventory = session.inventory;
      }
    } catch (error) {
      console.error('Failed to start game session:', error);
      // Continue without session tracking in case of error
    }
    
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
      // Apply time scale from slow time power-up
      const timeScale = this.powerUpManager.getTimeScale();
      const scaledDeltaTime = deltaTime * timeScale;
      
      // Call parent update with scaled time
      super.update(scaledDeltaTime);
      
      // Update camera
      this.camera.update();
      
      // Update background
      this.backgroundManager.update(this.camera.y, deltaTime);
      
      // Update combo manager
      this.comboManager.update(deltaTime); // Use real time for UI
      
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
        // Extended buffer to allow landing on platforms just off screen
        if (this.lastTime > 100 && this.player.y > this.camera.y + this.height + 150) {
          this.gameOver();
        }
      }
      
      // Update score based on height
      const heightScore = Math.max(0, Math.floor(-this.camera.y / 10));
      
      // Only update if we've climbed higher
      if (heightScore > this.baseHeightScore) {
        this.baseHeightScore = heightScore;
      }
      
      // Display score includes height + collected coins + bonuses
      const displayScore = this.baseHeightScore + this.score;
      
      // Check high score
      if (displayScore > this.highScore) {
        this.highScore = displayScore;
        this.saveHighScore(displayScore);
      }
    }
  }
  
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    
    if (this.gameState === 'loading') {
      // Simple background for loading
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, this.width, this.height);
      this.renderLoading();
    } else if (this.gameState === 'menu') {
      this.renderMenu(ctx);
    } else if (this.gameState === 'gameOver') {
      this.renderGameOver(ctx);
    } else if (this.gameState === 'playing') {
      // Render parallax background
      this.backgroundManager.render(ctx, this.camera.y);
      
      // Apply camera transform
      this.camera.applyTransform(ctx);
      
      // Render game objects in view
      for (const obj of this.gameObjects) {
        if (obj.render && this.camera.isInView(obj)) {
          // Pass shield status to player for glow effect
          if (obj === this.player) {
            const hasActiveShield = this.availablePowerUp === 'shield' || this.powerUpManager.isActive('shield');
            obj.render(ctx, hasActiveShield ? 1 : 0);
          } else {
            obj.render(ctx);
          }
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
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.menuState === 'main') {
      this.renderMainMenu(ctx);
    } else if (this.menuState === 'shop') {
      this.renderMenuPowerUpShop(ctx);
    } else if (this.menuState === 'powerups') {
      this.renderPowerUpShop(ctx);
    } else if (this.menuState === 'pre-game') {
      this.renderPreGameMenu(ctx);
    }
  }
  
  renderMainMenu(ctx) {
    // Animate the menu player
    this.updateMenuPlayer();
    
    // Draw animated player
    this.drawMenuPlayer(ctx);
    
    // Play button - moved up
    this.drawButton(ctx, this.width / 2, 210, 240, 70, 'PLAY', '#4a7c59');
    
    // Power-up selection header
    ctx.fillStyle = '#333';
    ctx.font = '500 20px Rubik, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Select Power-Up:', this.width / 2, 320);
    
    // Power-up toggles (2x2 grid without scoreBoost)
    const powerUpInfo = {
      rocket: { icon: '🚀', color: '#ef4444', desc: 'Double tap to boost' },
      shield: { icon: '🛡️', color: '#3b82f6', desc: 'Auto-saves from fall' },
      magnet: { icon: '🧲', color: '#8b5cf6', desc: 'Double tap for magnet' },
      slowTime: { icon: '⏱️', color: '#10b981', desc: 'Double tap to slow' }
    };
    
    // Center the 2x2 grid - increased spacing from header
    const gridWidth = 180; // 2 columns * 90px spacing
    const startX = this.width / 2 - gridWidth / 2 + 45; // Center and offset to button center
    const startY = 360;
    
    Object.entries(powerUpInfo).forEach(([type, info], index) => {
      const isSelected = this.selectedPowerUp === type;
      const hasInventory = this.powerUpInventory[type] > 0;
      
      // Power-up button position (2x2 grid)
      const col = index % 2;
      const row = Math.floor(index / 2);
      const btnX = startX + col * 90;
      const btnY = startY + row * 80;
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.beginPath();
      ctx.roundRect(btnX - 35 + 2, btnY - 30 + 2, 70, 60, 8);
      ctx.fill();
      
      // Draw background - simple solid colors
      if (isSelected) {
        ctx.fillStyle = info.color;
      } else if (hasInventory) {
        ctx.fillStyle = '#f3f4f6';
      } else {
        ctx.fillStyle = '#d1d5db';
      }
      ctx.beginPath();
      ctx.roundRect(btnX - 35, btnY - 30, 70, 60, 8);
      ctx.fill();
      
      // Add gradient overlay
      const btnGradient = ctx.createLinearGradient(btnX, btnY - 30, btnX, btnY + 30);
      btnGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      btnGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = btnGradient;
      ctx.beginPath();
      ctx.roundRect(btnX - 35, btnY - 30, 70, 60, 8);
      ctx.fill();
      
      // Add border for selected
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(btnX - 35, btnY - 30, 70, 60, 8);
        ctx.stroke();
      }
      
      // Icon - make sure fillStyle is set for emoji
      ctx.fillStyle = isSelected ? '#fff' : '#333';
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(info.icon, btnX, btnY);
      
      // Count
      ctx.fillStyle = isSelected ? '#fff' : '#333';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`x${this.powerUpInventory[type]}`, btnX, btnY + 22);
      
      // Disabled overlay if no inventory
      if (!hasInventory) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(btnX - 35, btnY - 30, 70, 60);
      }
    });
    
    // Selected power-up description (moved up)
    if (this.selectedPowerUp && powerUpInfo[this.selectedPowerUp]) {
      const selectedInfo = powerUpInfo[this.selectedPowerUp];
      
      // Description box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 100, 510, 200, 60, 8);
      ctx.fill();
      
      ctx.strokeStyle = selectedInfo.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 100, 510, 200, 60, 8);
      ctx.stroke();
      
      // Power-up name and description
      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${selectedInfo.icon} ${this.selectedPowerUp.toUpperCase()}`, this.width / 2, 535);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(selectedInfo.desc, this.width / 2, 555);
    }
    
    // Buy more power-ups button (moved up slightly)
    this.drawButton(ctx, this.width / 2, 610, 200, 40, '🛍️ BUY POWERUPS', '#8b5cf6');
  }
  
  // Helper function to shade colors
  shadeColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }
  
  updateMenuPlayer() {
    this.menuPlayerTime += 0.016; // Assume 60fps
    
    // Bouncing motion - moved up more
    this.menuPlayerY = 100 + Math.sin(this.menuPlayerTime * 3) * 12;
  }
  
  drawMenuPlayer(ctx) {
    const playerX = this.width / 2;
    const squash = 1 + Math.sin(this.menuPlayerTime * 6) * 0.1;
    const stretch = 1 - Math.sin(this.menuPlayerTime * 6) * 0.05;
    
    ctx.save();
    ctx.translate(playerX, this.menuPlayerY);
    
    // Add a little rotation for fun
    ctx.rotate(Math.sin(this.menuPlayerTime * 2) * 0.1);
    
    // Scale up the player by 2x width, 2.5x height for less squished look
    ctx.scale(2, 2.5);
    
    // Apply squash and stretch
    ctx.scale(squash, stretch);
    
    // Draw player (if image loaded, otherwise use fallback)
    if (this.assetLoader && this.assetLoader.get('player')) {
      const playerImg = this.assetLoader.get('player');
      ctx.drawImage(playerImg, -20, -20, 40, 40);
    } else {
      // Fallback - draw a green circle
      ctx.fillStyle = '#4a7c59';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-8, -5, 5, 0, Math.PI * 2);
      ctx.arc(8, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-8, -5, 2, 0, Math.PI * 2);
      ctx.arc(8, -5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // Add some decorative particles around player
    const time = this.menuPlayerTime;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + time;
      const x = playerX + Math.cos(angle) * 50;
      const y = this.menuPlayerY + Math.sin(angle) * 20;
      
      ctx.fillStyle = `rgba(74, 124, 89, ${0.3 + Math.sin(time * 2 + i) * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 + Math.sin(time * 3 + i) * 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  renderMenuPowerUpShop(ctx) {
    // Back button
    this.drawButton(ctx, 60, 50, 80, 40, '← Back', '#666');
    
    if (this.paymentState === 'processing' || this.paymentState === 'verifying') {
      // Loading state
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.paymentState === 'processing' ? 'Processing payment...' : 'Verifying transaction...', this.width / 2, this.height / 2);
      
      // Loading dots animation
      const time = Date.now() * 0.01;
      const centerX = this.width / 2;
      const centerY = this.height / 2 + 50;
      const dotColor = this.paymentState === 'processing' ? '#8b5cf6' : '#4a7c59';
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const x = centerX + Math.cos(angle) * 15;
        const y = centerY + Math.sin(angle) * 15;
        const opacity = 0.3 + 0.7 * Math.sin(time * 2 + i * 0.5);
        
        ctx.fillStyle = dotColor + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.paymentState === 'success') {
      // Success state for main menu
      ctx.fillStyle = '#10b981';
      ctx.font = '600 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🎉 CONGRATULATIONS! 🎉', this.width / 2, this.height / 2 - 60);
      
      ctx.fillStyle = '#333';
      ctx.font = '24px Arial';
      
      if (this.purchaseSuccessType === 'bundle') {
        ctx.fillText('You got 3 of each power-up!', this.width / 2, this.height / 2 - 10);
      } else {
        const powerUpNames = {
          rocket: 'Rocket Boost',
          shield: 'Shield Protection', 
          magnet: 'Coin Magnet',
          slowTime: 'Slow Time'
        };
        ctx.fillText(`You got 3x ${powerUpNames[this.purchaseSuccessType]}!`, this.width / 2, this.height / 2 - 10);
      }
      
      ctx.fillStyle = '#10b981';
      ctx.font = '20px Arial';
      ctx.fillText('Time to show off your new powers!', this.width / 2, this.height / 2 + 30);
      
      // Animated sparkles
      const sparkleTime = Date.now() * 0.005;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + sparkleTime;
        const radius = 60 + Math.sin(sparkleTime * 2 + i) * 20;
        const x = this.width / 2 + Math.cos(angle) * radius;
        const y = this.height / 2 + Math.sin(angle) * radius;
        
        ctx.fillStyle = `rgba(16, 185, 129, ${0.6 + Math.sin(sparkleTime * 3 + i) * 0.4})`;
        ctx.font = '20px Arial';
        ctx.fillText('✨', x, y);
      }
      
      // Continue button
      this.drawButton(ctx, this.width / 2, this.height / 2 + 100, 200, 50, 'AWESOME!', '#10b981');
    } else {
      // Power-up options
      const powerUpInfo = [
        { type: 'rocket', icon: '🚀', name: 'Rocket x3', price: '0.0005 HYPE', color: '#ef4444' },
        { type: 'shield', icon: '🛡️', name: 'Shield x3', price: '0.0005 HYPE', color: '#3b82f6' },
        { type: 'magnet', icon: '🧲', name: 'Magnet x3', price: '0.0005 HYPE', color: '#8b5cf6' },
        { type: 'slowTime', icon: '⏱️', name: 'Slow Time x3', price: '0.0005 HYPE', color: '#10b981' },
        { type: 'bundle', icon: '🎁', name: 'Bundle (All x3)', price: '0.0015 HYPE', color: '#f59e0b' }
      ];
      
      let rowY = 100; // Move down to avoid back button
      
      // Current inventory (bigger)
      ctx.fillStyle = '#333';
      ctx.font = '700 20px Rubik, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Current Inventory', this.width / 2, rowY);
      
      ctx.font = '24px Arial';
      const invText = `🚀 ${this.powerUpInventory.rocket}  🛡️ ${this.powerUpInventory.shield}  🧲 ${this.powerUpInventory.magnet}  ⏱️ ${this.powerUpInventory.slowTime}`;
      ctx.fillText(invText, this.width / 2, rowY + 35);
      
      rowY += 70;
      
      for (const info of powerUpInfo) {
        // Power-up row
        ctx.fillStyle = '#f3f4f6';
        ctx.beginPath();
        ctx.roundRect(this.width / 2 - 160, rowY, 320, 60, 8);
        ctx.fill();
        
        // Icon
        ctx.font = '28px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(info.icon, this.width / 2 - 140, rowY + 38);
        
        // Name
        ctx.fillStyle = '#333';
        ctx.font = '600 18px Rubik, Arial';
        ctx.fillText(info.name, this.width / 2 - 100, rowY + 28);
        
        // Price
        ctx.fillStyle = info.color;
        ctx.font = '700 16px Rubik, Arial';
        ctx.fillText(info.price, this.width / 2 - 100, rowY + 48);
        
        // Buy button
        this.drawButton(ctx, this.width / 2 + 100, rowY + 30, 60, 35, 'BUY', info.color);
        
        rowY += 70;
      }
      
      // Info text
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Purchases give 3 uses of each power-up', this.width / 2, this.height - 30);
    }
  }
  
  renderPowerUpShop(ctx) {
    // Header
    ctx.fillStyle = '#333';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Power-Up Inventory', this.width / 2, 60);
    
    // Back button
    this.drawButton(ctx, 60, 40, 80, 40, '← Back', '#666');
    
    // Power-up grid
    const powerUpInfo = {
      rocket: { icon: '🚀', name: 'Rocket', color: '#ef4444', desc: 'Boost upward' },
      shield: { icon: '🛡️', name: 'Shield', color: '#3b82f6', desc: 'Fall protection' },
      magnet: { icon: '🧲', name: 'Magnet', color: '#8b5cf6', desc: 'Attract coins' },
      scoreBoost: { icon: '⭐', name: '2X Score', color: '#f59e0b', desc: 'Double points' },
      slowTime: { icon: '⏱️', name: 'Slow Time', color: '#10b981', desc: 'Slow motion' }
    };
    
    let y = 140;
    for (const [type, info] of Object.entries(powerUpInfo)) {
      // Power-up card
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(this.width / 2 - 150, y, 300, 80);
      
      // Icon and name
      ctx.font = '32px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(info.icon, this.width / 2 - 130, y + 35);
      
      ctx.fillStyle = info.color;
      ctx.font = 'bold 24px Arial';
      ctx.fillText(info.name, this.width / 2 - 80, y + 30);
      
      // Description
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText(info.desc, this.width / 2 - 80, y + 55);
      
      // Inventory count
      ctx.fillStyle = '#333';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`x${this.powerUpInventory[type]}`, this.width / 2 + 120, y + 45);
      
      y += 90;
    }
    
    // Info text
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Select power-ups before starting a game!', this.width / 2, this.height - 30);
  }
  
  renderPreGameMenu(ctx) {
    // Header
    ctx.fillStyle = '#333';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Select a Power-Up', this.width / 2, 60);
    
    // Back button
    this.drawButton(ctx, 60, 40, 80, 40, '← Back', '#666');
    
    // Power-up selection
    const powerUpInfo = {
      rocket: { icon: '🚀', name: 'Rocket', color: '#ef4444' },
      shield: { icon: '🛡️', name: 'Shield', color: '#3b82f6' },
      magnet: { icon: '🧲', name: 'Magnet', color: '#8b5cf6' },
      scoreBoost: { icon: '⭐', name: '2X Score', color: '#f59e0b' },
      slowTime: { icon: '⏱️', name: 'Slow Time', color: '#10b981' }
    };
    
    let y = 120;
    for (const [type, info] of Object.entries(powerUpInfo)) {
      const isSelected = this.selectedPowerUp === type;
      const hasInventory = this.powerUpInventory[type] > 0;
      
      // Card background
      ctx.fillStyle = isSelected ? info.color : (hasInventory ? '#f3f4f6' : '#e5e7eb');
      ctx.fillRect(this.width / 2 - 120, y, 240, 60);
      
      // Content
      ctx.font = '24px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = isSelected ? '#fff' : (hasInventory ? '#333' : '#999');
      ctx.fillText(`${info.icon} ${info.name}`, this.width / 2 - 100, y + 38);
      
      // Count
      ctx.textAlign = 'right';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`x${this.powerUpInventory[type]}`, this.width / 2 + 100, y + 38);
      
      y += 70;
    }
    
    // Start button
    const buttonColor = this.selectedPowerUp ? '#4a7c59' : '#9ca3af';
    const buttonText = this.selectedPowerUp ? '🎮 START WITH POWER-UP' : '🎮 START';
    this.drawButton(ctx, this.width / 2, y + 40, 280, 60, buttonText, buttonColor);
    
    // Info
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.selectedPowerUp ? 
      'Power-up will activate at game start!' : 
      'Play without power-up or select one above', 
      this.width / 2, y + 120);
  }
  
  drawButton(ctx, x, y, width, height, text, color) {
    // Button shadow with rounded corners
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.roundRect(x - width/2 + 4, y - height/2 + 4, width, height, 12);
    ctx.fill();
    
    // Button background with rounded corners
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - width/2, y - height/2, width, height, 12);
    ctx.fill();
    
    // Button inner highlight
    const gradient = ctx.createLinearGradient(x, y - height/2, x, y + height/2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x - width/2, y - height/2, width, height, 12);
    ctx.fill();
    
    // Button text
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px Rubik, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    
    ctx.textBaseline = 'alphabetic';
  }
  
  handleMenuClick(x, y) {
    if (this.menuState === 'main') {
      // Play button - updated position
      if (y >= 175 && y <= 245 && x >= this.width/2 - 120 && x <= this.width/2 + 120) {
        eventBus.emit(Events.HAPTIC_TRIGGER, 'medium');
        this.startGameWithPowerUp();
        return;
      }
      
      // Power-up buttons (2x2 grid)
      const powerUpTypes = ['rocket', 'shield', 'magnet', 'slowTime'];
      const gridWidth = 180;
      const startX = this.width / 2 - gridWidth / 2 + 45;
      const startY = 360;
      
      powerUpTypes.forEach((type, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const btnX = startX + col * 90;
        const btnY = startY + row * 80;
        
        if (x >= btnX - 35 && x <= btnX + 35 && y >= btnY - 30 && y <= btnY + 30) {
          if (this.powerUpInventory[type] > 0) {
            eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
            this.selectedPowerUp = this.selectedPowerUp === type ? null : type;
          }
        }
      });
      
      // Buy more button
      if (this.isPointInButton(x, y, this.width / 2, 610, 200, 40)) {
        this.menuState = 'shop';
        eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
        return;
      }
    } 
    else if (this.menuState === 'shop') {
      // Back button
      if (this.isPointInButton(x, y, 60, 50, 80, 40)) {
        this.menuState = 'main';
        this.paymentState = null;
        eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
        return;
      }
      
      if (this.paymentState === null) {
        // Power-up buy buttons
        const powerUpInfo = [
          { type: 'rocket', icon: '🚀', name: 'Rocket x3', price: '0.0005 HYPE', color: '#ef4444' },
          { type: 'shield', icon: '🛡️', name: 'Shield x3', price: '0.0005 HYPE', color: '#3b82f6' },
          { type: 'magnet', icon: '🧲', name: 'Magnet x3', price: '0.0005 HYPE', color: '#8b5cf6' },
          { type: 'slowTime', icon: '⏱️', name: 'Slow Time x3', price: '0.0005 HYPE', color: '#10b981' },
          { type: 'bundle', icon: '🎁', name: 'Bundle (All x3)', price: '0.0015 HYPE', color: '#f59e0b' }
        ];
        
        let rowY = 170; // Start y position (adjusted for moved layout)
        for (const info of powerUpInfo) {
          // Buy button position
          if (this.isPointInButton(x, y, this.width / 2 + 100, rowY + 30, 60, 35)) {
            this.processPowerUpPurchase(info.type);
            return;
          }
          rowY += 70;
        }
      } else if (this.paymentState === 'success') {
        // Success screen button
        if (this.isPointInButton(x, y, this.width / 2, this.height / 2 + 100, 200, 50)) {
          this.paymentState = null;
          this.purchaseSuccessType = null;
          eventBus.emit(Events.HAPTIC_TRIGGER, 'success');
          return;
        }
      }
    }
    else if (this.menuState === 'powerups') {
      // This state is no longer used
      this.menuState = 'main';
    }
    else if (this.menuState === 'pre-game') {
      // This state is no longer used
      this.menuState = 'main';
    }
  }
  
  isPointInButton(x, y, buttonX, buttonY, buttonWidth, buttonHeight) {
    return x >= buttonX - buttonWidth/2 && x <= buttonX + buttonWidth/2 &&
           y >= buttonY - buttonHeight/2 && y <= buttonY + buttonHeight/2;
  }
  
  startGameWithPowerUp() {
    // Use selected power-up from inventory
    if (this.selectedPowerUp && this.powerUpInventory[this.selectedPowerUp] > 0) {
      this.powerUpInventory[this.selectedPowerUp]--;
      this.availablePowerUp = this.selectedPowerUp;
    }
    
    this.startGame();
    
    // Shield is not auto-activated, player can activate it manually like other power-ups
  }
  
  async usePowerUp() {
    if (!this.availablePowerUp || this.gameState !== 'playing') return;
    
    // Don't allow using if already active
    if (this.powerUpManager.isActive(this.availablePowerUp)) return;
    
    const powerUpTypes = {
      rocket: { icon: '🚀', name: 'Rocket', color: '#ef4444', duration: 3000 },
      magnet: { icon: '🧲', name: 'Magnet', color: '#8b5cf6', duration: 5000 },
      slowTime: { icon: '⏱️', name: 'Slow Time', color: '#10b981', duration: 5000 }
    };
    
    const powerUpInfo = powerUpTypes[this.availablePowerUp];
    if (powerUpInfo) {
      // Track power-up usage
      const powerUpType = this.availablePowerUp;
      if (!this.powerUpsUsedThisGame[powerUpType]) {
        this.powerUpsUsedThisGame[powerUpType] = 0;
      }
      this.powerUpsUsedThisGame[powerUpType]++;
      
      // Notify backend of power-up usage
      if (this.gameSessionId) {
        try {
          await paymentService.usePowerUp(powerUpType, this.gameSessionId);
        } catch (error) {
          console.error('Failed to track power-up usage:', error);
        }
      }
      
      this.powerUpManager.activatePowerUp({
        type: powerUpType,
        properties: powerUpInfo
      });
      this.availablePowerUp = null; // Power-up is consumed
      eventBus.emit(Events.POWERUP_USE, powerUpType);
      eventBus.emit(Events.HAPTIC_TRIGGER, 'success');
    }
  }
  
  renderGameOver(ctx) {
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Game over title
    ctx.fillStyle = '#333';
    ctx.font = '700 48px Rubik, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', this.width / 2, 80);
    
    // Score box with shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 150 + 4, 140 + 4, 300, 100, 12);
    ctx.fill();
    
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 150, 140, 300, 100, 12);
    ctx.fill();
    
    const finalScore = this.baseHeightScore + this.score;
    
    ctx.fillStyle = '#333';
    ctx.font = '700 32px Rubik, Arial';
    ctx.fillText(`Score: ${finalScore.toLocaleString()}`, this.width / 2, 185);
    
    ctx.font = '500 20px Rubik, Arial';
    ctx.fillStyle = finalScore > this.highScore ? '#4a7c59' : '#666';
    ctx.fillText(finalScore > this.highScore ? 'NEW HIGH SCORE!' : `High Score: ${this.highScore.toLocaleString()}`, 
                 this.width / 2, 220);
    
    // Show payment modal or regular game over options
    if (this.paymentModal === 'powerups') {
      this.renderPowerUpPurchaseModal(ctx);
    } else if (this.paymentState === 'processing' || this.paymentState === 'verifying') {
      // Show loading state for continue payment
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.paymentState === 'processing' ? 'Processing payment...' : 'Verifying transaction...', this.width / 2, 320);
      
      // Loading dots animation
      const time = Date.now() * 0.01;
      const centerX = this.width / 2;
      const centerY = 380;
      const dotColor = this.paymentState === 'processing' ? '#f59e0b' : '#4a7c59';
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const x = centerX + Math.cos(angle) * 15;
        const y = centerY + Math.sin(angle) * 15;
        const opacity = 0.3 + 0.7 * Math.sin(time * 2 + i * 0.5);
        
        ctx.fillStyle = dotColor + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.paymentState === 'error') {
      // Show error state for continue payment
      ctx.fillStyle = '#dc2626';
      ctx.font = '600 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Payment Failed', this.width / 2, 280);
      
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      const errorMessage = this.paymentError || 'Transaction failed. Please try again.';
      ctx.fillText(errorMessage, this.width / 2, 310);
      
      // Try again button
      this.drawButton(ctx, this.width / 2, 350, 200, 50, 'TRY AGAIN', '#f59e0b');
      
      // Menu button
      this.drawButton(ctx, this.width / 2, 410, 200, 50, 'BACK TO MENU', '#6b7280');
    } else {
      // Continue button (payment)
      this.drawButton(ctx, this.width / 2, 290, 240, 60, 'CONTINUE', '#f59e0b');
      
      // Power-ups button if inventory is low
      let showPowerUpShop = false;
      for (const [type, count] of Object.entries(this.powerUpInventory)) {
        if (count === 0) {
          showPowerUpShop = true;
          break;
        }
      }
      
      if (showPowerUpShop) {
        this.drawButton(ctx, this.width / 2, 360, 240, 60, '🛍️ BUY POWERUPS', '#8b5cf6');
      }
      
      // Return to menu button
      this.drawButton(ctx, this.width / 2, showPowerUpShop ? 430 : 360, 200, 50, '🏠 MENU', '#4a7c59');
      
      // Info
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.fillText('Continue playing or return to menu', this.width / 2, this.height - 40);
    }
  }
  
  renderUI(ctx) {
    // Calculate display score
    const displayScore = this.baseHeightScore + this.score;
    
    // Check if we're in dark theme (space)
    const isDarkTheme = Math.abs(this.camera.y) > 15000;
    
    // Score - white text for dark backgrounds
    ctx.fillStyle = isDarkTheme ? '#fff' : '#333';
    ctx.font = '700 24px Rubik, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${displayScore.toLocaleString()}`, 20, 40);
    
    // Combo display
    const combo = this.comboManager.getCombo();
    if (combo > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 20px Rubik, Arial';
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
      
      // Simple text instruction - white for dark theme
      ctx.fillStyle = isDarkTheme ? `rgba(255, 255, 255, ${0.7 * alpha})` : `rgba(0, 0, 0, ${0.5 * alpha})`;
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Touch left or right side to move', this.width / 2, this.height - 40);
    }
    
    // Show available power-up button (but not shield since it's automatic)
    if (this.availablePowerUp && this.availablePowerUp !== 'shield') {
      const powerUpInfo = {
        rocket: { icon: '🚀', color: '#ef4444' },
        magnet: { icon: '🧲', color: '#8b5cf6' },
        slowTime: { icon: '⏱️', color: '#10b981' }
      };
      
      const info = powerUpInfo[this.availablePowerUp];
      if (info) {
        // Draw power-up button in bottom right
        const btnX = this.width - 60;
        const btnY = this.height - 60;
        
        // Button background
        ctx.fillStyle = info.color;
        ctx.fillRect(btnX - 30, btnY - 30, 60, 60);
        
        // Button border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(btnX - 30, btnY - 30, 60, 60);
        
        // Icon
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(info.icon, btnX, btnY + 10);
        
        // Instructions
        ctx.font = '12px Arial';
        ctx.fillStyle = '#333';
        ctx.fillText('Double tap', btnX, btnY - 40);
      }
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
        
        // Only allow collision if platform is visible on screen (not below camera view)
        const cameraBottom = this.camera.y + this.height;
        if (platformBounds.top > cameraBottom) continue;
        
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
    const magnetRadius = this.powerUpManager.isActive('magnet') ? 250 : 0;
    
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
        coin.x += (this.player.x - coin.x) * attraction * 0.2;
        coin.y += (this.player.y - coin.y) * attraction * 0.2;
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
    
    // Shield effect - check for fall protection (activate closer to bottom of screen)
    if (this.player && this.player.y > this.camera.y + this.height - 50 && 
        this.player.velocityY > 0 && (this.availablePowerUp === 'shield' || this.powerUpManager.isActive('shield'))) {
      
      // Track shield usage
      if (!this.powerUpsUsedThisGame['shield']) {
        this.powerUpsUsedThisGame['shield'] = 0;
      }
      this.powerUpsUsedThisGame['shield']++;
      
      // Notify backend of shield usage
      if (this.gameSessionId) {
        try {
          paymentService.usePowerUp('shield', this.gameSessionId);
        } catch (error) {
          console.error('Failed to track shield usage:', error);
        }
      }
      
      // Consume the shield from whichever system it came from
      if (this.availablePowerUp === 'shield') {
        this.availablePowerUp = null;
      } else if (this.powerUpManager.isActive('shield')) {
        this.powerUpManager.useShield();
      }
      
      // Bounce player back up
      this.player.velocityY = -800;
      this.player.jump(-800);
      eventBus.emit(Events.HAPTIC_TRIGGER, 'heavy');
      
      // Shield break effect
      this.particleManager.createShieldBreakParticles(this.player.x, this.player.y);
    }
  }
  
  async gameOver() {
    this.gameState = 'gameOver';
    this.pause();
    this.paymentModal = null;
    this.paymentState = null;
    eventBus.emit(Events.GAME_OVER);
    eventBus.emit(Events.HAPTIC_TRIGGER, 'heavy');
    
    // End game session
    if (this.gameSessionId) {
      try {
        await paymentService.endGameSession(this.gameSessionId, {
          score: this.baseHeightScore + this.score,
          height: Math.abs(this.camera.y),
          powerupsUsed: this.powerUpsUsedThisGame,
          coinsCollected: this.coinsCollectedThisGame
        });
      } catch (error) {
        console.error('Failed to end game session:', error);
      }
    }
    
    this.startGameOverAnimation();
  }
  
  startGameOverAnimation() {
    const animate = () => {
      if (this.gameState === 'gameOver') {
        this.render();
        requestAnimationFrame(animate);
      }
    };
    animate();
  }
  
  renderPayToContinueModal(ctx) {
    // Modal background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Modal box
    const modalWidth = 320;
    const modalHeight = 400;
    const modalX = (this.width - modalWidth) / 2;
    const modalY = (this.height - modalHeight) / 2;
    
    // Modal shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(modalX + 4, modalY + 4, modalWidth, modalHeight, 16);
    ctx.fill();
    
    // Modal background
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(modalX, modalY, modalWidth, modalHeight, 16);
    ctx.fill();
    
    // Header
    ctx.fillStyle = '#333';
    ctx.font = '700 24px Rubik, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Continue Playing?', this.width / 2, modalY + 50);
    
    if (this.paymentState === 'processing') {
      // Loading state
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText('Processing payment...', this.width / 2, modalY + 200);
      
      // Loading dots animation
      const time = Date.now() * 0.01;
      const centerX = this.width / 2;
      const centerY = modalY + 250;
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const x = centerX + Math.cos(angle) * 15;
        const y = centerY + Math.sin(angle) * 15;
        const opacity = 0.3 + 0.7 * Math.sin(time * 2 + i * 0.5);
        
        ctx.fillStyle = '#f59e0b' + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.paymentState === 'verifying') {
      // Verifying state
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText('Verifying transaction...', this.width / 2, modalY + 200);
      
      // Loading dots animation
      const time = Date.now() * 0.01;
      const centerX = this.width / 2;
      const centerY = modalY + 250;
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const x = centerX + Math.cos(angle) * 15;
        const y = centerY + Math.sin(angle) * 15;
        const opacity = 0.3 + 0.7 * Math.sin(time * 2 + i * 0.5);
        
        ctx.fillStyle = '#4a7c59' + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.paymentState === 'error') {
      // Error state
      ctx.fillStyle = '#dc2626';
      ctx.font = '600 18px Arial';
      ctx.fillText('Payment Failed', this.width / 2, modalY + 180);
      
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      const errorMessage = this.paymentError || 'Transaction failed. Please try again.';
      
      // Word wrap for long error messages
      const words = errorMessage.split(' ');
      let line = '';
      let y = modalY + 220;
      const maxWidth = modalWidth - 60;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, this.width / 2, y);
          line = words[n] + ' ';
          y += 25;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, this.width / 2, y);
      
      // Try again button
      this.drawButton(ctx, this.width / 2, modalY + 320, 200, 50, 'TRY AGAIN', '#f59e0b');
      
      // Cancel button
      this.drawButton(ctx, this.width / 2, modalY + 380, 200, 50, 'CANCEL', '#6b7280');
    } else {
      // Payment info
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText('Continue from a safe position', this.width / 2, modalY + 90);
      ctx.fillText('and keep your current score!', this.width / 2, modalY + 110);
      
      // Price box
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.roundRect(modalX + 60, modalY + 140, 200, 80, 8);
      ctx.fill();
      
      ctx.fillStyle = '#333';
      ctx.font = '700 28px Rubik, Arial';
      ctx.fillText('0.001 HYPE', this.width / 2, modalY + 185);
      
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.fillText('One-time payment', this.width / 2, modalY + 205);
      
      // Pay button
      this.drawButton(ctx, this.width / 2, modalY + 270, 200, 50, '💳 PAY NOW', '#f59e0b');
      
      // Cancel button
      this.drawButton(ctx, this.width / 2, modalY + 330, 200, 50, 'CANCEL', '#6b7280');
    }
  }
  
  renderPowerUpPurchaseModal(ctx) {
    // Modal background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Modal box
    const modalWidth = 340;
    const modalHeight = 500;
    const modalX = (this.width - modalWidth) / 2;
    const modalY = (this.height - modalHeight) / 2;
    
    // Modal shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(modalX + 4, modalY + 4, modalWidth, modalHeight, 16);
    ctx.fill();
    
    // Modal background
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(modalX, modalY, modalWidth, modalHeight, 16);
    ctx.fill();
    
    // Header
    ctx.fillStyle = '#333';
    ctx.font = '700 24px Rubik, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Power-Up Shop', this.width / 2, modalY + 50);
    
    if (this.paymentState === 'processing') {
      // Loading state
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText('Processing payment...', this.width / 2, modalY + 250);
      
      // Loading dots animation
      const time = Date.now() * 0.01;
      const centerX = this.width / 2;
      const centerY = modalY + 300;
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const x = centerX + Math.cos(angle) * 15;
        const y = centerY + Math.sin(angle) * 15;
        const opacity = 0.3 + 0.7 * Math.sin(time * 2 + i * 0.5);
        
        ctx.fillStyle = '#8b5cf6' + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.paymentState === 'verifying') {
      // Verifying state
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText('Verifying transaction...', this.width / 2, modalY + 250);
      
      // Loading dots animation
      const time = Date.now() * 0.01;
      const centerX = this.width / 2;
      const centerY = modalY + 300;
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const x = centerX + Math.cos(angle) * 15;
        const y = centerY + Math.sin(angle) * 15;
        const opacity = 0.3 + 0.7 * Math.sin(time * 2 + i * 0.5);
        
        ctx.fillStyle = '#4a7c59' + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.paymentState === 'error') {
      // Error state
      ctx.fillStyle = '#dc2626';
      ctx.font = '600 18px Arial';
      ctx.fillText('Purchase Failed', this.width / 2, modalY + 220);
      
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      const errorMessage = this.paymentError || 'Transaction failed. Please try again.';
      
      // Word wrap for long error messages
      const words = errorMessage.split(' ');
      let line = '';
      let y = modalY + 260;
      const maxWidth = modalWidth - 60;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, this.width / 2, y);
          line = words[n] + ' ';
          y += 25;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, this.width / 2, y);
      
      // Try again button
      this.drawButton(ctx, this.width / 2, modalY + 350, 200, 50, 'TRY AGAIN', '#8b5cf6');
      
      // Close button
      this.drawButton(ctx, this.width / 2, modalY + 410, 160, 40, 'CLOSE', '#6b7280');
    } else if (this.paymentState === 'success') {
      // Success state
      ctx.fillStyle = '#10b981';
      ctx.font = '600 24px Arial';
      ctx.fillText('🎉 Purchase Successful! 🎉', this.width / 2, modalY + 200);
      
      ctx.fillStyle = '#333';
      ctx.font = '18px Arial';
      
      if (this.purchaseSuccessType === 'bundle') {
        ctx.fillText('You got 3 of each power-up!', this.width / 2, modalY + 240);
      } else {
        const powerUpNames = {
          rocket: 'Rocket',
          shield: 'Shield', 
          magnet: 'Magnet',
          slowTime: 'Slow Time'
        };
        ctx.fillText(`You got 3x ${powerUpNames[this.purchaseSuccessType]}!`, this.width / 2, modalY + 240);
      }
      
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.fillText('Ready to dominate the game!', this.width / 2, modalY + 280);
      
      // Continue button
      this.drawButton(ctx, this.width / 2, modalY + 350, 160, 40, 'AWESOME!', '#10b981');
    } else {
      // Power-up options
      const powerUpInfo = [
        { type: 'rocket', icon: '🚀', name: 'Rocket x3', price: '0.0005 HYPE', color: '#ef4444' },
        { type: 'shield', icon: '🛡️', name: 'Shield x3', price: '0.0005 HYPE', color: '#3b82f6' },
        { type: 'magnet', icon: '🧲', name: 'Magnet x3', price: '0.0005 HYPE', color: '#8b5cf6' },
        { type: 'slowTime', icon: '⏱️', name: 'Slow Time x3', price: '0.0005 HYPE', color: '#10b981' },
        { type: 'bundle', icon: '🎁', name: 'Bundle (All x3)', price: '0.0015 HYPE', color: '#f59e0b' }
      ];
      
      let rowY = modalY + 90;
      
      for (const info of powerUpInfo) {
        // Power-up row
        ctx.fillStyle = '#f3f4f6';
        ctx.beginPath();
        ctx.roundRect(modalX + 20, rowY, modalWidth - 40, 60, 8);
        ctx.fill();
        
        // Icon
        ctx.font = '28px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(info.icon, modalX + 40, rowY + 38);
        
        // Name
        ctx.fillStyle = '#333';
        ctx.font = '600 18px Rubik, Arial';
        ctx.fillText(info.name, modalX + 80, rowY + 28);
        
        // Price
        ctx.fillStyle = info.color;
        ctx.font = '700 16px Rubik, Arial';
        ctx.fillText(info.price, modalX + 80, rowY + 48);
        
        // Buy button
        const btnX = modalX + modalWidth - 80;
        const btnY = rowY + 30;
        
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.roundRect(btnX - 25, btnY - 15, 50, 30, 6);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '700 14px Rubik, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BUY', btnX, btnY + 3);
        
        rowY += 70;
      }
      
      // Close button
      ctx.textAlign = 'center';
      this.drawButton(ctx, this.width / 2, modalY + modalHeight - 60, 160, 40, 'CLOSE', '#6b7280');
      
      // Info text
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.fillText('Purchases give 3 uses of each power-up', this.width / 2, modalY + modalHeight - 20);
    }
  }
  
  handleGameOverClick(x, y) {
    if (this.paymentModal === 'powerups') {
      const modalWidth = 340;
      const modalHeight = 500;
      const modalX = (this.width - modalWidth) / 2;
      const modalY = (this.height - modalHeight) / 2;
      
      if (this.paymentState === null) {
        // Check for power-up buy buttons
        const powerUpInfo = [
          { type: 'rocket', icon: '🚀', name: 'Rocket x3', price: '0.0005 ETH', color: '#ef4444' },
          { type: 'shield', icon: '🛡️', name: 'Shield x3', price: '0.0005 ETH', color: '#3b82f6' },
          { type: 'magnet', icon: '🧲', name: 'Magnet x3', price: '0.0005 ETH', color: '#8b5cf6' },
          { type: 'slowTime', icon: '⏱️', name: 'Slow Time x3', price: '0.0005 ETH', color: '#10b981' },
          { type: 'bundle', icon: '🎁', name: 'Bundle (All x3)', price: '0.0015 ETH', color: '#f59e0b' }
        ];
        
        let rowY = modalY + 90;
        for (const info of powerUpInfo) {
          const btnX = modalX + modalWidth - 80;
          const btnY = rowY + 30;
          
          if (x >= btnX - 25 && x <= btnX + 25 && y >= btnY - 15 && y <= btnY + 15) {
            this.processPowerUpPurchase(info.type);
            return;
          }
          
          rowY += 70;
        }
        
        // Close button
        if (this.isPointInButton(x, y, this.width / 2, modalY + modalHeight - 60, 160, 40)) {
          this.paymentModal = null;
          eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
          return;
        }
      } else if (this.paymentState === 'error') {
        // Try again button
        if (this.isPointInButton(x, y, this.width / 2, modalY + 350, 200, 50)) {
          this.paymentState = null;
          this.paymentError = null;
          eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
          return;
        }
        
        // Close button
        if (this.isPointInButton(x, y, this.width / 2, modalY + 410, 160, 40)) {
          this.paymentModal = null;
          this.paymentState = null;
          this.paymentError = null;
          eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
          return;
        }
      } else if (this.paymentState === 'success') {
        // Success screen button
        if (this.isPointInButton(x, y, this.width / 2, modalY + 350, 160, 40)) {
          this.paymentModal = null;
          this.paymentState = null;
          this.purchaseSuccessType = null;
          eventBus.emit(Events.HAPTIC_TRIGGER, 'success');
          return;
        }
      }
    } else if (this.paymentState === 'error') {
      // Handle error state buttons
      
      // Try again button
      if (this.isPointInButton(x, y, this.width / 2, 350, 200, 50)) {
        this.paymentState = null;
        this.paymentError = null;
        this.processContinuePayment();
        return;
      }
      
      // Back to menu button
      if (this.isPointInButton(x, y, this.width / 2, 410, 200, 50)) {
        this.paymentState = null;
        this.paymentError = null;
        this.showMenu();
        eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
        return;
      }
    } else {
      // Continue button - direct payment
      if (this.isPointInButton(x, y, this.width / 2, 290, 240, 60)) {
        this.processContinuePayment();
        return;
      }
      
      // Power-ups button (if shown)
      let showPowerUpShop = false;
      for (const [type, count] of Object.entries(this.powerUpInventory)) {
        if (count === 0) {
          showPowerUpShop = true;
          break;
        }
      }
      
      if (showPowerUpShop && this.isPointInButton(x, y, this.width / 2, 360, 240, 60)) {
        this.paymentModal = 'powerups';
        eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
        return;
      }
      
      // Menu button
      const menuY = showPowerUpShop ? 430 : 360;
      if (this.isPointInButton(x, y, this.width / 2, menuY, 200, 50)) {
        this.showMenu();
        eventBus.emit(Events.HAPTIC_TRIGGER, 'selection');
        return;
      }
    }
  }
  
  async processContinuePayment() {
    try {
      this.paymentState = 'processing';
      eventBus.emit(Events.HAPTIC_TRIGGER, 'medium');
      
      // Make payment
      const result = await paymentService.payContinue(
        this.baseHeightScore + this.score,
        Math.abs(this.camera.y)
      );
      
      this.paymentState = 'verifying';
      
      // Wait for verification (in production this would check the actual transaction)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Success! Continue the game
      this.continuePlaying();
      
    } catch (error) {
      console.error('Payment failed:', error);
      this.paymentState = 'error';
      this.paymentError = error.message || 'Payment failed. Please try again.';
      eventBus.emit(Events.HAPTIC_TRIGGER, 'error');
      
      // Auto-hide error after 3 seconds
      setTimeout(() => {
        if (this.paymentState === 'error') {
          this.paymentState = null;
          this.paymentModal = null;
          this.paymentError = null;
        }
      }, 3000);
    }
  }
  
  continuePlaying() {
    // Reset game over state
    this.gameState = 'playing';
    this.paymentModal = null;
    this.paymentState = null;
    
    // Clear existing platforms and game objects (except essential ones)
    for (const platform of this.platforms) {
      this.removeGameObject(platform);
    }
    this.platforms = [];
    
    // Clear coins and power-ups too
    for (const coin of this.coins) {
      this.removeGameObject(coin);
    }
    this.coins = [];
    
    for (const powerUp of this.powerUps) {
      this.removeGameObject(powerUp);
    }
    this.powerUps = [];
    
    // Place player on a safe platform
    const safeY = this.camera.y + this.height / 2;
    const safeX = this.width / 2;
    
    // Create a safe platform for the player
    const safePlatform = new Platform(safeX, safeY + 100, 'normal', this.assetLoader);
    this.platforms.push(safePlatform);
    this.addGameObject(safePlatform);
    
    // Make sure player is in game objects
    if (!this.gameObjects.includes(this.player)) {
      this.addGameObject(this.player);
    }
    
    // Reset player position and velocity
    this.player.x = safeX;
    this.player.y = safeY;
    this.player.velocityY = -600; // Give a small boost
    
    // Update camera to follow player
    this.camera.follow(this.player);
    this.camera.y = this.player.y - this.height / 2;
    
    // Generate more platforms above the safe platform
    for (let i = 1; i <= 15; i++) {
      const x = Math.random() * (this.width - 70) + 35;
      const y = safeY + 100 - (i * this.platformSpacing);
      const platform = new Platform(x, y, 'normal', this.assetLoader);
      this.platforms.push(platform);
      this.addGameObject(platform);
    }
    
    // Update platform spawn position
    this.platformSpawnY = safeY + 100 - (15 * this.platformSpacing);
    
    // Re-add particle manager if not present
    if (!this.gameObjects.includes(this.particleManager)) {
      this.addGameObject(this.particleManager);
    }
    
    // Resume game engine
    this.resume();
    eventBus.emit(Events.HAPTIC_TRIGGER, 'success');
  }
  
  async processPowerUpPurchase(type) {
    try {
      this.paymentState = 'processing';
      this.selectedPowerUpPurchase = type;
      eventBus.emit(Events.HAPTIC_TRIGGER, 'medium');
      
      // Make payment
      const result = await paymentService.purchasePowerUps(type, 1);
      
      this.paymentState = 'verifying';
      
      // Wait for verification
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Success! Reload inventory from backend to ensure sync
      try {
        const inventory = await paymentService.getInventory();
        this.powerUpInventory = inventory;
      } catch (error) {
        console.error('Failed to reload inventory:', error);
        // Fallback to local update if backend fails
        if (type === 'bundle') {
          // Add 3 of each power-up
          this.powerUpInventory.rocket += 3;
          this.powerUpInventory.shield += 3;
          this.powerUpInventory.magnet += 3;
          this.powerUpInventory.slowTime += 3;
        } else {
          // Add 3 of the selected power-up
          this.powerUpInventory[type] += 3;
        }
      }
      
      // Show success screen
      this.paymentState = 'success';
      this.purchaseSuccessType = type;
      eventBus.emit(Events.HAPTIC_TRIGGER, 'success');
      
      // Auto-hide success after 3 seconds
      setTimeout(() => {
        if (this.paymentState === 'success') {
          this.paymentModal = null;
          this.paymentState = null;
          this.purchaseSuccessType = null;
        }
      }, 3000);
      
    } catch (error) {
      console.error('Power-up purchase failed:', error);
      this.paymentState = 'error';
      this.paymentError = error.message || 'Purchase failed. Please try again.';
      eventBus.emit(Events.HAPTIC_TRIGGER, 'error');
      
      // Auto-hide error after 3 seconds
      setTimeout(() => {
        if (this.paymentState === 'error') {
          this.paymentState = null;
          this.paymentModal = null;
          this.paymentError = null;
        }
      }, 3000);
    }
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