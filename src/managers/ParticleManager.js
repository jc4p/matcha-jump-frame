import { Particle } from '../entities/Particle.js';
import { eventBus, Events } from '../eventBus.js';

export class ParticleManager {
  constructor() {
    this.particles = [];
    this.bindEvents();
  }
  
  bindEvents() {
    eventBus.on(Events.PLAYER_JUMP, (player) => {
      this.createJumpParticles(player.x, player.y + player.height / 2);
    });
    
    eventBus.on(Events.PLAYER_LAND, (player) => {
      this.createLandingParticles(player.x, player.y + player.height / 2);
    });
    
    eventBus.on(Events.PLATFORM_DESTROY, (platform) => {
      this.createBreakParticles(platform.x, platform.y);
    });
  }
  
  createJumpParticles(x, y) {
    const particleCount = 5;
    const colors = ['#9ca3af', '#d1d5db', '#e5e7eb'];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI / 4) + (Math.PI / 2) * (i / particleCount);
      const speed = 100 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.3 + Math.random() * 0.2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 2;
      
      this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
  }
  
  createLandingParticles(x, y) {
    const particleCount = 8;
    const colors = ['#9ca3af', '#d1d5db'];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2) * (i / particleCount);
      const speed = 50 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed * 0.5 - 50;
      const life = 0.4 + Math.random() * 0.2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 1.5 + Math.random() * 1.5;
      
      this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
  }
  
  createBreakParticles(x, y) {
    const particleCount = 12;
    const colors = ['#ef4444', '#dc2626', '#b91c1c'];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 100;
      const life = 0.5 + Math.random() * 0.3;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 3 + Math.random() * 3;
      
      this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
  }
  
  createCoinParticles(x, y) {
    const particleCount = 10;
    const colors = ['#fbbf24', '#fcd34d', '#fde68a'];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2) * (i / particleCount);
      const speed = 100 + Math.random() * 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.6 + Math.random() * 0.3;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 2;
      
      this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
  }
  
  createRocketParticles(x, y) {
    const particleCount = 3;
    const colors = ['#ef4444', '#f87171', '#fbbf24'];
    
    for (let i = 0; i < particleCount; i++) {
      const vx = (Math.random() - 0.5) * 100;
      const vy = 200 + Math.random() * 100;
      const life = 0.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 4;
      
      this.particles.push(new Particle(x + (Math.random() - 0.5) * 20, y, vx, vy, life, color, size));
    }
  }
  
  createShieldBreakParticles(x, y) {
    const particleCount = 20;
    const colors = ['#3b82f6', '#60a5fa', '#93c5fd'];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2) * (i / particleCount);
      const speed = 200 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 3 + Math.random() * 3;
      
      this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
  }
  
  createComboParticles(x, y) {
    const particleCount = 15;
    const colors = ['#f59e0b', '#fbbf24', '#fcd34d'];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2) * (i / particleCount);
      const speed = 150 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 50;
      const life = 1.0;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 4;
      
      this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
  }
  
  update(deltaTime) {
    this.particles = this.particles.filter(particle => particle.update(deltaTime));
  }
  
  render(ctx) {
    for (const particle of this.particles) {
      particle.render(ctx);
    }
  }
  
  getBounds() {
    return {
      left: -Infinity,
      right: Infinity,
      top: -Infinity,
      bottom: Infinity
    };
  }
}