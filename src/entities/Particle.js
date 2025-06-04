export class Particle {
  constructor(x, y, vx, vy, life, color = '#ffffff', size = 3) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.gravity = 400;
  }
  
  update(deltaTime) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.vy += this.gravity * deltaTime;
    this.life -= deltaTime;
    
    return this.life > 0;
  }
  
  render(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    
    const currentSize = this.size * alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 1;
  }
  
  getBounds() {
    return {
      left: this.x - this.size,
      right: this.x + this.size,
      top: this.y - this.size,
      bottom: this.y + this.size
    };
  }
}