export class BackgroundManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    // Background layers with different parallax speeds
    this.layers = [
      {
        // Far background - sky gradient
        type: 'gradient',
        speed: 0,
        colors: ['#87CEEB', '#E0F6FF']
      },
      {
        // Distant clouds
        type: 'clouds',
        speed: 0.1,
        clouds: this.generateClouds(5, 0.3, 0.5),
        opacity: 0.3
      },
      {
        // Medium clouds
        type: 'clouds',
        speed: 0.3,
        clouds: this.generateClouds(8, 0.5, 0.8),
        opacity: 0.5
      },
      {
        // Near clouds
        type: 'clouds',
        speed: 0.5,
        clouds: this.generateClouds(10, 0.8, 1.2),
        opacity: 0.7
      }
    ];
    
    // Height-based themes (adjusted to prevent too much white)
    this.themes = {
      sky: { start: 0, end: 5000, color1: '#87CEEB', color2: '#B8E0F5' },
      clouds: { start: 5000, end: 15000, color1: '#B8E0F5', color2: '#D4EDFC' },
      space: { start: 15000, end: Infinity, color1: '#1a1a2e', color2: '#16213e' }
    };
  }
  
  generateClouds(count, minScale, maxScale) {
    const clouds = [];
    for (let i = 0; i < count; i++) {
      clouds.push({
        x: Math.random() * this.width * 2,
        y: Math.random() * this.height,
        width: 100 + Math.random() * 200,
        height: 40 + Math.random() * 60,
        scale: minScale + Math.random() * (maxScale - minScale),
        offsetY: 0
      });
    }
    return clouds;
  }
  
  update(cameraY, deltaTime) {
    // Update cloud positions based on camera movement
    this.layers.forEach(layer => {
      if (layer.type === 'clouds') {
        layer.clouds.forEach(cloud => {
          // Parallax movement
          cloud.offsetY = cameraY * layer.speed;
          
          // Wrap clouds vertically
          const effectiveY = cloud.y + cloud.offsetY;
          if (effectiveY > this.height + cloud.height) {
            cloud.y -= this.height + cloud.height * 2;
          } else if (effectiveY < -cloud.height) {
            cloud.y += this.height + cloud.height * 2;
          }
        });
      }
    });
  }
  
  getCurrentTheme(height) {
    const absHeight = Math.abs(height);
    for (const [name, theme] of Object.entries(this.themes)) {
      if (absHeight >= theme.start && absHeight < theme.end) {
        return theme;
      }
    }
    return this.themes.sky;
  }
  
  render(ctx, cameraY) {
    const currentTheme = this.getCurrentTheme(cameraY);
    
    // Render gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, currentTheme.color1);
    gradient.addColorStop(1, currentTheme.color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Add stars for space theme
    if (Math.abs(cameraY) > this.themes.space.start) {
      this.renderStars(ctx, cameraY);
    }
    
    // Render cloud layers
    this.layers.forEach(layer => {
      if (layer.type === 'clouds') {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        
        layer.clouds.forEach(cloud => {
          const y = cloud.y + cloud.offsetY;
          this.drawCloud(ctx, cloud.x, y, cloud.width, cloud.height, cloud.scale);
        });
        
        ctx.restore();
      }
    });
  }
  
  drawCloud(ctx, x, y, width, height, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Draw fluffy cloud shape (reduced opacity to prevent too much white)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    
    // Cloud is made of overlapping circles
    const circles = [
      { x: width * 0.3, y: height * 0.7, r: height * 0.4 },
      { x: width * 0.5, y: height * 0.4, r: height * 0.5 },
      { x: width * 0.7, y: height * 0.6, r: height * 0.45 },
      { x: width * 0.2, y: height * 0.8, r: height * 0.3 },
      { x: width * 0.8, y: height * 0.8, r: height * 0.3 }
    ];
    
    // Create cloud shape by drawing all circles in one path
    circles.forEach((circle, index) => {
      // Move to the edge of the circle before drawing to prevent lines
      ctx.moveTo(circle.x + circle.r, circle.y);
      ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    });
    
    ctx.fill();
    ctx.restore();
  }
  
  renderStars(ctx, cameraY) {
    const starDensity = Math.min(1, (Math.abs(cameraY) - this.themes.space.start) / 5000);
    
    ctx.save();
    ctx.fillStyle = 'white';
    
    // Use camera position as seed for consistent star placement
    const seed = Math.floor(Math.abs(cameraY) / 1000);
    
    for (let i = 0; i < 50 * starDensity; i++) {
      const x = ((seed * i * 9973) % this.width);
      const y = ((seed * i * 7919) % this.height);
      const size = ((seed * i * 3571) % 3) + 1;
      const brightness = 0.3 + ((seed * i * 2341) % 70) / 100;
      
      ctx.globalAlpha = brightness * starDensity;
      ctx.fillRect(x, y, size, size);
    }
    
    ctx.restore();
  }
  
  resize(width, height) {
    this.width = width;
    this.height = height;
    
    // Regenerate clouds for new dimensions
    this.layers.forEach(layer => {
      if (layer.type === 'clouds') {
        const count = layer.clouds.length;
        const minScale = layer.clouds[0]?.scale || 0.5;
        const maxScale = minScale + 0.3;
        layer.clouds = this.generateClouds(count, minScale, maxScale);
      }
    });
  }
}