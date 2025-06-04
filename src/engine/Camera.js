export class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
    this.target = null;
  }
  
  follow(target) {
    this.target = target;
  }
  
  update() {
    if (!this.target) return;
    
    // Keep player in upper half of screen when jumping up
    const targetY = this.target.y - this.height * 0.5;
    
    // Only move camera up, never down (this creates the scrolling effect)
    if (targetY < this.y) {
      this.y = targetY;
    }
  }
  
  applyTransform(ctx) {
    ctx.save();
    ctx.translate(0, -this.y);
  }
  
  restoreTransform(ctx) {
    ctx.restore();
  }
  
  isInView(obj) {
    if (!obj || typeof obj.y === 'undefined') return false;
    
    const objHeight = obj.height || 0;
    const objBottom = obj.y + objHeight / 2;
    const objTop = obj.y - objHeight / 2;
    const cameraBottom = this.y + this.height;
    const cameraTop = this.y;
    
    return objBottom > cameraTop && objTop < cameraBottom;
  }
  
  worldToScreen(worldY) {
    return worldY - this.y;
  }
  
  screenToWorld(screenY) {
    return screenY + this.y;
  }
}