import { eventBus, Events } from '../eventBus.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lastTime = 0;
    this.deltaTime = 0;
    this.isRunning = false;
    this.gameObjects = [];
    
    this.setupCanvas();
    this.bindEvents();
  }
  
  setupCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    this.canvas.width = window.innerWidth * window.devicePixelRatio;
    this.canvas.height = window.innerHeight * window.devicePixelRatio;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }
  
  bindEvents() {
    eventBus.on(Events.GAME_START, () => this.start());
    eventBus.on(Events.GAME_PAUSE, () => this.pause());
    eventBus.on(Events.GAME_RESUME, () => this.resume());
    eventBus.on(Events.GAME_OVER, () => this.stop());
  }
  
  addGameObject(obj) {
    this.gameObjects.push(obj);
  }
  
  removeGameObject(obj) {
    const index = this.gameObjects.indexOf(obj);
    if (index > -1) {
      this.gameObjects.splice(index, 1);
    }
  }
  
  start() {
    this.isRunning = true;
    this.lastTime = 0;
    this.gameLoop();
  }
  
  pause() {
    this.isRunning = false;
  }
  
  resume() {
    this.isRunning = true;
    this.lastTime = 0;
    this.gameLoop();
  }
  
  stop() {
    this.isRunning = false;
    this.gameObjects = [];
  }
  
  gameLoop(currentTime = 0) {
    if (!this.isRunning) return;
    
    // Skip first frame or use fixed deltaTime
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
      requestAnimationFrame((time) => this.gameLoop(time));
      return;
    }
    
    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Cap deltaTime to prevent huge jumps
    if (this.deltaTime > 0.1 || this.deltaTime <= 0) {
      this.deltaTime = 0.016; // ~60fps
    }
    
    this.update(this.deltaTime);
    this.render();
    
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  
  update(deltaTime) {
    for (const obj of this.gameObjects) {
      if (obj.update) {
        obj.update(deltaTime);
      }
    }
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    this.ctx.fillStyle = '#87CEEB';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    for (const obj of this.gameObjects) {
      if (obj.render) {
        obj.render(this.ctx);
      }
    }
  }
}