import { eventBus, Events } from '../eventBus.js';

export class Coin {
  constructor(x, y, value = 10) {
    this.x = x;
    this.y = y;
    this.width = 20;
    this.height = 20;
    this.value = value;
    this.collected = false;
    
    // Animation
    this.rotation = 0;
    this.floatOffset = Math.random() * Math.PI * 2;
    this.floatSpeed = 2;
    this.floatAmount = 5;
    
    // Visual
    this.baseY = y;
  }
  
  update(deltaTime) {
    if (this.collected) return;
    
    // Rotate
    this.rotation += deltaTime * 3;
    
    // Float up and down
    this.floatOffset += deltaTime * this.floatSpeed;
    this.y = this.baseY + Math.sin(this.floatOffset) * this.floatAmount;
  }
  
  render(ctx) {
    if (this.collected) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Draw coin
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    
    // Coin circle
    ctx.beginPath();
    ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Inner circle
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(0, 0, this.width / 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Dollar sign or star
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 0);
    
    ctx.restore();
  }
  
  collect() {
    if (this.collected) return;
    
    this.collected = true;
    eventBus.emit(Events.COIN_COLLECTED, this);
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