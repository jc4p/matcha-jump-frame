import { eventBus, Events } from '../eventBus.js';

export class ComboManager {
  constructor() {
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.comboTimeout = 2; // seconds to maintain combo
    this.lastPlatformY = null;
    this.perfectLandingThreshold = 10; // pixels for perfect landing
    
    this.bindEvents();
  }
  
  bindEvents() {
    eventBus.on(Events.PLAYER_LAND, (player) => {
      this.checkCombo(player);
    });
    
    eventBus.on(Events.PLAYER_FALL, () => {
      this.breakCombo();
    });
    
    eventBus.on(Events.GAME_OVER, () => {
      this.reset();
    });
  }
  
  checkCombo(player) {
    // Check if it's a perfect landing (landing near the peak of jump)
    const isPerfectLanding = Math.abs(player.velocityY) < 100;
    
    if (isPerfectLanding) {
      this.incrementCombo();
    } else {
      // Still landed, but not perfect - maintain combo but don't increment
      this.comboTimer = this.comboTimeout;
    }
  }
  
  incrementCombo() {
    this.combo++;
    this.comboTimer = this.comboTimeout;
    
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    
    eventBus.emit(Events.COMBO_INCREMENT, this.combo);
    
    // Bonus points for combo milestones
    if (this.combo === 5) {
      eventBus.emit(Events.SCORE_UPDATE, 50); // 50 bonus points
      eventBus.emit(Events.COMBO_MILESTONE, { combo: 5, bonus: 50 });
    } else if (this.combo === 10) {
      eventBus.emit(Events.SCORE_UPDATE, 100);
      eventBus.emit(Events.COMBO_MILESTONE, { combo: 10, bonus: 100 });
    } else if (this.combo === 20) {
      eventBus.emit(Events.SCORE_UPDATE, 200);
      eventBus.emit(Events.COMBO_MILESTONE, { combo: 20, bonus: 200 });
    } else if (this.combo % 10 === 0 && this.combo > 20) {
      const bonus = this.combo * 10;
      eventBus.emit(Events.SCORE_UPDATE, bonus);
      eventBus.emit(Events.COMBO_MILESTONE, { combo: this.combo, bonus });
    }
  }
  
  breakCombo() {
    if (this.combo > 0) {
      eventBus.emit(Events.COMBO_BREAK, this.combo);
      this.combo = 0;
      this.comboTimer = 0;
    }
  }
  
  update(deltaTime) {
    if (this.combo > 0 && this.comboTimer > 0) {
      this.comboTimer -= deltaTime;
      
      if (this.comboTimer <= 0) {
        this.breakCombo();
      }
    }
  }
  
  reset() {
    this.combo = 0;
    this.comboTimer = 0;
    this.lastPlatformY = null;
  }
  
  getCombo() {
    return this.combo;
  }
  
  getMaxCombo() {
    return this.maxCombo;
  }
  
  getMultiplier() {
    // Return combo multiplier based on current combo
    if (this.combo >= 20) return 3;
    if (this.combo >= 10) return 2;
    if (this.combo >= 5) return 1.5;
    return 1;
  }
}