import { eventBus, Events } from '../eventBus.js';

export class PowerUpManager {
  constructor() {
    this.activePowerUps = new Map();
    this.bindEvents();
  }
  
  bindEvents() {
    eventBus.on(Events.POWERUP_COLLECT, (powerUp) => {
      this.activatePowerUp(powerUp);
    });
    
    eventBus.on(Events.GAME_OVER, () => {
      this.clearAllPowerUps();
    });
  }
  
  activatePowerUp(powerUp) {
    const { type, properties } = powerUp;
    
    // Clear existing power-up of same type
    if (this.activePowerUps.has(type)) {
      clearTimeout(this.activePowerUps.get(type).timeout);
    }
    
    // Activate power-up
    const powerUpData = {
      type,
      properties,
      startTime: Date.now()
    };
    
    // Set expiration if it has duration
    if (properties.duration > 0) {
      powerUpData.timeout = setTimeout(() => {
        this.deactivatePowerUp(type);
      }, properties.duration);
    }
    
    this.activePowerUps.set(type, powerUpData);
    eventBus.emit(Events.POWERUP_ACTIVATE, { type, properties });
    
    // Play power-up sound
    eventBus.emit(Events.AUDIO_PLAY, 'powerup');
  }
  
  deactivatePowerUp(type) {
    const powerUp = this.activePowerUps.get(type);
    if (powerUp) {
      if (powerUp.timeout) {
        clearTimeout(powerUp.timeout);
      }
      this.activePowerUps.delete(type);
      eventBus.emit(Events.POWERUP_EXPIRE, type);
    }
  }
  
  isActive(type) {
    return this.activePowerUps.has(type);
  }
  
  getActivePowerUps() {
    return Array.from(this.activePowerUps.entries()).map(([type, data]) => ({
      type,
      ...data,
      remainingTime: data.properties.duration > 0 
        ? Math.max(0, data.properties.duration - (Date.now() - data.startTime))
        : -1
    }));
  }
  
  clearAllPowerUps() {
    for (const [type, powerUp] of this.activePowerUps) {
      if (powerUp.timeout) {
        clearTimeout(powerUp.timeout);
      }
    }
    this.activePowerUps.clear();
  }
  
  // Special methods for specific power-ups
  useShield() {
    if (this.isActive('shield')) {
      this.deactivatePowerUp('shield');
      return true;
    }
    return false;
  }
  
  getScoreMultiplier() {
    return this.isActive('scoreBoost') ? 2 : 1;
  }
  
  getTimeScale() {
    return this.isActive('slowTime') ? 0.5 : 1;
  }
}