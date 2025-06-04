import { eventBus, Events } from '../eventBus.js';

export class Player {
  constructor(x, y, assetLoader) {
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 48; // Made 20% taller
    this.velocityX = 0;
    this.velocityY = 0;
    this.gravity = 800;
    this.jumpPower = -500;
    this.moveSpeed = 300;
    this.isJumping = false;
    this.assetLoader = assetLoader;
    this.image = this.assetLoader.get('player');
    
    // Animation properties
    this.scaleX = 1;
    this.scaleY = 1;
    this.targetScaleX = 1;
    this.targetScaleY = 1;
    this.scaleSpeed = 12;
    
    // Anticipation and follow-through
    this.rotation = 0;
    this.targetRotation = 0;
    this.rotationSpeed = 8;
    
    // Timing states
    this.anticipationTimer = 0;
    this.isAnticipating = false;
    this.landingTimer = 0;
    
    this.bindEvents();
  }
  
  bindEvents() {
    // Desktop controls
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.velocityX = -this.moveSpeed;
      } else if (e.key === 'ArrowRight') {
        this.velocityX = this.moveSpeed;
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.velocityX = 0;
      }
    });
    
    // Mobile controls - simple left/right halves
    const handleTouch = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const screenWidth = window.innerWidth;
        const touchX = touch.clientX;
        
        // Left half = move left
        if (touchX < screenWidth / 2) {
          this.velocityX = -this.moveSpeed;
        } else {
          // Right half = move right
          this.velocityX = this.moveSpeed;
        }
      }
    };
    
    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('touchmove', handleTouch);
    
    window.addEventListener('touchend', () => {
      this.velocityX = 0;
    });
  }
  
  prepareJump() {
    // Anticipation - squash before jump
    this.isAnticipating = true;
    this.anticipationTimer = 0.1;
    this.targetScaleX = 1.2;
    this.targetScaleY = 0.8;
  }
  
  jump(power = this.jumpPower) {
    this.velocityY = power;
    this.isJumping = true;
    this.isAnticipating = false;
    
    // Dramatic stretch animation on jump
    if (power < -700) {
      // Super jump - even more dramatic
      this.targetScaleX = 0.6;
      this.targetScaleY = 1.6;
    } else {
      this.targetScaleX = 0.7;
      this.targetScaleY = 1.4;
    }
    
    eventBus.emit(Events.PLAYER_JUMP, this);
  }
  
  land() {
    this.isJumping = false;
    this.landingTimer = 0.2;
    
    // Dramatic squash animation on land
    this.targetScaleX = 1.5;
    this.targetScaleY = 0.5;
    
    eventBus.emit(Events.PLAYER_LAND, this);
  }
  
  update(deltaTime) {
    // Handle anticipation timer (not used in automatic jumping)
    if (this.anticipationTimer > 0) {
      this.anticipationTimer -= deltaTime;
    }
    
    // Handle landing recovery
    if (this.landingTimer > 0) {
      this.landingTimer -= deltaTime;
      if (this.landingTimer <= 0) {
        // Overshoot and settle
        this.targetScaleX = 0.95;
        this.targetScaleY = 1.05;
      }
    }
    
    this.velocityY += this.gravity * deltaTime;
    
    // Cap fall speed
    if (this.velocityY > 600) {
      this.velocityY = 600;
    }
    
    this.x += this.velocityX * deltaTime;
    this.y += this.velocityY * deltaTime;
    
    // Keep player within screen bounds
    if (this.x < this.width / 2) {
      this.x = this.width / 2;
    } else if (this.x > window.innerWidth - this.width / 2) {
      this.x = window.innerWidth - this.width / 2;
    }
    
    if (this.velocityY > 0) {
      this.isJumping = true;
    }
    
    // Rotation based on horizontal movement
    this.targetRotation = (this.velocityX / this.moveSpeed) * 0.15;
    
    // Easing function for more natural animation
    const easeOutElastic = (t) => {
      const p = 0.3;
      return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    };
    
    // Animate scale with easing
    const scaleDiffX = this.targetScaleX - this.scaleX;
    const scaleDiffY = this.targetScaleY - this.scaleY;
    
    this.scaleX += scaleDiffX * this.scaleSpeed * deltaTime;
    this.scaleY += scaleDiffY * this.scaleSpeed * deltaTime;
    
    // Animate rotation
    this.rotation += (this.targetRotation - this.rotation) * this.rotationSpeed * deltaTime;
    
    // Reset target scale when close to normal
    if (Math.abs(this.scaleX - 1) < 0.02 && Math.abs(this.scaleY - 1) < 0.02 && this.landingTimer <= 0) {
      this.targetScaleX = 1;
      this.targetScaleY = 1;
    }
  }
  
  render(ctx, shieldCount = 0) {
    ctx.save();
    
    // Shield glow effect
    if (shieldCount > 0) {
      // Animated pulsing glow
      const time = Date.now() * 0.003;
      const glowIntensity = 0.5 + 0.3 * Math.sin(time);
      const glowSize = 8 + 4 * Math.sin(time * 1.2);
      
      // Create radial gradient for glow
      const gradient = ctx.createRadialGradient(
        this.x, this.y, this.width / 4,
        this.x, this.y, this.width / 2 + glowSize
      );
      gradient.addColorStop(0, `rgba(59, 130, 246, ${glowIntensity * 0.8})`);
      gradient.addColorStop(0.7, `rgba(59, 130, 246, ${glowIntensity * 0.4})`);
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      
      // Draw glow circle
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width / 2 + glowSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw shield icon indicator
      ctx.fillStyle = `rgba(59, 130, 246, ${glowIntensity})`;
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️', this.x, this.y - this.height / 2 - 10);
    }
    
    // Apply transformations
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);
    
    if (this.image && this.image.complete) {
      ctx.drawImage(
        this.image,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    } else {
      // Fallback if image not loaded
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    }
    
    ctx.restore();
  }
  
  getBounds() {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2
    };
  }
}