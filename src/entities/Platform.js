import { eventBus, Events } from '../eventBus.js';

export class Platform {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.width = 70;
    this.height = 15;
    this.type = type;
    this.isDestroyed = false;
    
    this.images = {
      normal: new Image(),
      moving: new Image(),
      breakable: new Image(),
      spring: new Image()
    };
    
    this.images.normal.src = '/images/plate_rectangle_1.png';
    this.images.moving.src = '/images/plate_rectangle_2.png';
    this.images.breakable.src = '/images/plate_rectangle_3.png';
    this.images.spring.src = '/images/plate_circle.png';
    
    if (type === 'moving') {
      this.velocityX = 100;
      this.minX = x - 50;
      this.maxX = x + 50;
    }
    
    // Spring animation
    if (type === 'spring') {
      this.springAnimation = 0;
      this.springBounce = false;
    }
    
    eventBus.emit(Events.PLATFORM_SPAWN, this);
  }
  
  update(deltaTime) {
    if (this.type === 'moving' && !this.isDestroyed) {
      this.x += this.velocityX * deltaTime;
      
      if (this.x <= this.minX || this.x >= this.maxX) {
        this.velocityX *= -1;
      }
    }
    
    // Spring platform bounce animation
    if (this.type === 'spring' && this.springBounce) {
      this.springAnimation += deltaTime * 15;
      if (this.springAnimation > Math.PI * 2) {
        this.springAnimation = 0;
        this.springBounce = false;
      }
    }
  }
  
  render(ctx) {
    if (this.isDestroyed) return;
    
    ctx.save();
    
    // Spring platform bounce effect
    if (this.type === 'spring' && this.springBounce) {
      const bounce = Math.sin(this.springAnimation) * 0.2;
      ctx.translate(this.x, this.y);
      ctx.scale(1 + bounce, 1 - bounce);
      ctx.translate(-this.x, -this.y);
    }
    
    const image = this.images[this.type];
    
    if (image && image.complete) {
      ctx.drawImage(
        image,
        this.x - this.width / 2,
        this.y - this.height / 2,
        this.width,
        this.height
      );
    } else {
      if (this.type === 'normal') {
        ctx.fillStyle = '#4ade80';
      } else if (this.type === 'moving') {
        ctx.fillStyle = '#3b82f6';
      } else if (this.type === 'breakable') {
        ctx.fillStyle = '#ef4444';
      } else if (this.type === 'spring') {
        ctx.fillStyle = '#fbbf24';
      }
      
      ctx.fillRect(
        this.x - this.width / 2,
        this.y - this.height / 2,
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
  
  onPlayerLand() {
    if (this.type === 'breakable') {
      this.isDestroyed = true;
      eventBus.emit(Events.PLATFORM_DESTROY, this);
    } else if (this.type === 'spring') {
      this.springBounce = true;
      this.springAnimation = 0;
    }
  }
}