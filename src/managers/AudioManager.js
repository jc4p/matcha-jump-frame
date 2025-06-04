import { eventBus, Events } from '../eventBus.js';
import { GameSynth } from '../audio/GameSynth.js';

export class AudioManager {
  constructor() {
    this.synth = new GameSynth();
    this.enabled = true;
    this.volume = 0.5;
    this.initialized = false;
    
    this.bindEvents();
  }
  
  async init() {
    if (this.initialized) return;
    
    try {
      await this.synth.init();
      this.synth.setVolume(this.volume);
      this.initialized = true;
      
      // Start ambient background
      this.playAmbientBackground();
    } catch (e) {
      console.warn('Failed to initialize audio:', e);
    }
  }
  
  bindEvents() {
    // Play jump sound on player jump
    eventBus.on(Events.PLAYER_JUMP, (player) => {
      this.playJump();
    });
    
    // Play landing sound
    eventBus.on(Events.PLAYER_LAND, (player) => {
      this.playLand();
    });
    
    // Play coin collection sound
    eventBus.on(Events.COIN_COLLECTED, (coin) => {
      this.playCoin();
    });
    
    // Play platform break sound
    eventBus.on(Events.PLATFORM_DESTROY, (platform) => {
      if (platform.type === 'breakable') {
        this.playBreak();
      }
    });
    
    // Play spring sound on spring platform
    eventBus.on(Events.PLAYER_SPRING, () => {
      this.playSpring();
    });
    
    // Play game over sound
    eventBus.on(Events.GAME_OVER, () => {
      this.playGameOver();
    });
    
    // Play power-up collection sound
    eventBus.on(Events.POWERUP_COLLECT, () => {
      this.playPowerUp();
    });
  }
  
  playJump() {
    if (!this.enabled || !this.initialized) return;
    
    // Vary the velocity based on jump height
    const velocity = 0.6 + Math.random() * 0.3;
    this.synth.playJump(velocity);
  }
  
  playLand() {
    if (!this.enabled || !this.initialized) return;
    
    const velocity = 0.5 + Math.random() * 0.3;
    this.synth.playLand(velocity);
  }
  
  playCoin() {
    if (!this.enabled || !this.initialized) return;
    
    this.synth.playCoin();
  }
  
  playBreak() {
    if (!this.enabled || !this.initialized) return;
    
    this.synth.playBreak();
  }
  
  playSpring() {
    if (!this.enabled || !this.initialized) return;
    
    this.synth.playSpring();
  }
  
  playGameOver() {
    if (!this.enabled || !this.initialized) return;
    
    this.synth.playGameOver();
  }
  
  playPowerUp() {
    if (!this.enabled || !this.initialized) return;
    
    this.synth.playPowerUp();
  }
  
  playAmbientBackground() {
    if (!this.enabled || !this.initialized) return;
    
    // Play ambient chords that change based on height
    const chordProgressions = [
      ["C3", "E3", "G3", "B3"],
      ["D3", "F#3", "A3", "C4"],
      ["E3", "G#3", "B3", "D4"],
      ["F3", "A3", "C4", "E4"],
      ["G3", "B3", "D4", "F#4"],
      ["A3", "C#4", "E4", "G4"]
    ];
    
    let chordIndex = 0;
    
    const playNextChord = () => {
      if (!this.enabled) return;
      
      this.synth.playAmbientChord(chordProgressions[chordIndex], 4);
      chordIndex = (chordIndex + 1) % chordProgressions.length;
      
      // Play next chord after 4 seconds
      setTimeout(playNextChord, 4000);
    };
    
    playNextChord();
  }
  
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.synth) {
      this.synth.setVolume(this.volume);
    }
  }
  
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.synth) {
      this.synth.mute();
    } else if (this.enabled && this.synth) {
      this.synth.unmute();
    }
    return this.enabled;
  }
  
  // Initialize audio on user interaction (required for mobile)
  async resumeContext() {
    await this.init();
  }
}