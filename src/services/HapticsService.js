import * as frame from '@farcaster/frame-sdk';

export class HapticsService {
  constructor() {
    this.isFrameEnvironment = false;
    this.vibrationSupported = false;
    this.frameHapticsSupported = {
      impact: false,
      notification: false,
      selection: false
    };
    
    this.init();
  }
  
  async init() {
    // Check for Frame SDK haptics support
    try {
      const capabilities = await frame.sdk.getCapabilities();
      this.isFrameEnvironment = true;
      
      this.frameHapticsSupported = {
        impact: capabilities.includes('haptics.impactOccurred'),
        notification: capabilities.includes('haptics.notificationOccurred'),
        selection: capabilities.includes('haptics.selectionChanged')
      };
    } catch (e) {
      // Not in Frame environment
      this.isFrameEnvironment = false;
    }
    
    // Check for standard Vibration API support
    this.vibrationSupported = 'vibrate' in navigator;
  }
  
  async trigger(type, intensity = 'medium') {
    // Try Frame SDK haptics first
    if (this.isFrameEnvironment) {
      try {
        switch (type) {
          case 'light':
          case 'medium':
          case 'heavy':
          case 'soft':
          case 'rigid':
            if (this.frameHapticsSupported.impact) {
              await frame.sdk.haptics.impactOccurred(type);
              return;
            }
            break;
            
          case 'success':
          case 'warning':
          case 'error':
            if (this.frameHapticsSupported.notification) {
              await frame.sdk.haptics.notificationOccurred(type);
              return;
            }
            break;
            
          case 'selection':
            if (this.frameHapticsSupported.selection) {
              await frame.sdk.haptics.selectionChanged();
              return;
            }
            break;
        }
      } catch (e) {
        // Frame haptics failed, fall back to Vibration API
      }
    }
    
    // Fall back to Vibration API
    if (this.vibrationSupported) {
      this.vibratePattern(type);
    }
  }
  
  vibratePattern(type) {
    if (!this.vibrationSupported) return;
    
    // Define vibration patterns for different feedback types
    const patterns = {
      // Impact patterns
      light: [10],
      medium: [20],
      heavy: [40],
      soft: [15, 10, 15],
      rigid: [30],
      
      // Notification patterns
      success: [10, 50, 10, 50, 10],
      warning: [30, 30, 30],
      error: [50, 100, 50],
      
      // Selection pattern
      selection: [5],
      
      // Game-specific patterns
      jump: [15],
      land: [10],
      spring: [20, 20, 20],
      powerup: [20, 40, 20],
      coin: [5, 5],
      combo: [10, 10, 10, 10, 10],
      gameOver: [100, 50, 100]
    };
    
    const pattern = patterns[type] || patterns.medium;
    
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration failed
      console.warn('Vibration failed:', e);
    }
  }
  
  // Convenience methods for common game events
  jump() {
    this.trigger('light');
  }
  
  land() {
    this.trigger('light');
  }
  
  springBounce() {
    this.trigger('heavy');
  }
  
  collectCoin() {
    this.vibratePattern('coin');
  }
  
  collectPowerUp() {
    this.trigger('success');
  }
  
  comboMilestone() {
    this.vibratePattern('combo');
  }
  
  gameOver() {
    this.trigger('heavy');
  }
  
  buttonPress() {
    this.trigger('selection');
  }
  
  // Check if any haptics are available
  isAvailable() {
    return this.isFrameEnvironment || this.vibrationSupported;
  }
}

// Export singleton instance
export const hapticsService = new HapticsService();