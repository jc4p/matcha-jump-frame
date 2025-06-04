import { eventBus, Events } from '../eventBus.js';

export class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 30;
    this.type = type;
    this.collected = false;
    
    // Animation
    this.rotation = 0;
    this.floatOffset = Math.random() * Math.PI * 2;
    this.floatSpeed = 3;
    this.floatAmount = 8;
    this.pulseScale = 1;
    
    // Visual
    this.baseY = y;
    
    // Power-up properties
    this.properties = this.getPowerUpProperties(type);
  }
  
  getPowerUpProperties(type) {
    const properties = {
      rocket: {
        color: '#ef4444',
        icon: '🚀',
        duration: 3000,
        name: 'Rocket Boost'
      },
      shield: {
        color: '#3b82f6',
        icon: '🛡️',
        duration: 0, // Until used
        name: 'Shield'
      },
      magnet: {
        color: '#8b5cf6',
        icon: '🧲',
        duration: 10000,
        name: 'Coin Magnet'
      },
      scoreBoost: {
        color: '#10b981',
        icon: '2X',
        duration: 15000,
        name: 'Score Multiplier'
      },
      slowTime: {
        color: '#f59e0b',
        icon: '⏱️',
        duration: 5000,
        name: 'Slow Time'
      }
    };
    
    return properties[type] || properties.rocket;
  }
  
  update(deltaTime) {
    if (this.collected) return;
    
    // Rotate
    this.rotation += deltaTime * 2;
    
    // Float up and down
    this.floatOffset += deltaTime * this.floatSpeed;
    this.y = this.baseY + Math.sin(this.floatOffset) * this.floatAmount;
    
    // Pulse effect
    this.pulseScale = 1 + Math.sin(this.floatOffset * 2) * 0.1;
  }
  
  render(ctx) {
    if (this.collected) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.pulseScale, this.pulseScale);
    
    // Glow effect
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width);
    gradient.addColorStop(0, this.properties.color + '88');
    gradient.addColorStop(0.5, this.properties.color + '44');
    gradient.addColorStop(1, this.properties.color + '00');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-this.width * 1.5, -this.height * 1.5, this.width * 3, this.height * 3);
    
    // Main circle
    ctx.fillStyle = this.properties.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Inner circle
    ctx.fillStyle = this.properties.color + 'dd';
    ctx.beginPath();
    ctx.arc(0, 0, this.width / 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Icon
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.properties.icon, 0, 0);
    
    ctx.restore();
  }
  
  collect() {
    if (this.collected) return;
    
    this.collected = true;
    eventBus.emit(Events.POWERUP_COLLECT, this);
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