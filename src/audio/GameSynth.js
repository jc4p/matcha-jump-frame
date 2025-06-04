import * as Tone from 'tone';

// Game-specific synth based on Prophet-style architecture
export class GameSynth {
  constructor() {
    // Master effects chain
    this.masterVolume = new Tone.Volume(-6).toDestination();
    
    // Effects
    this.chorus = new Tone.Chorus({
      frequency: 0.5,
      delayTime: 3.5,
      depth: 0.7,
      wet: 0.3
    }).connect(this.masterVolume);
    
    this.reverb = new Tone.Reverb({
      decay: 1.5,
      wet: 0.15
    }).connect(this.masterVolume);
    
    this.delay = new Tone.FeedbackDelay({
      delayTime: "16n",
      feedback: 0.3,
      wet: 0.2
    }).connect(this.masterVolume);
    
    // Jump synth - bright and ascending
    this.jumpSynth = new Tone.MonoSynth({
      oscillator: {
        type: "sawtooth"
      },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 0.2
      },
      filter: {
        Q: 6,
        type: "lowpass",
        rolloff: -24
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.5,
        release: 0.2,
        baseFrequency: 200,
        octaves: 4,
        exponent: 2
      }
    }).connect(this.chorus);
    
    // Landing synth - deep thud
    this.landSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 2,
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.4
      }
    }).connect(this.reverb);
    
    // Coin synth - sparkly and rewarding
    this.coinSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle"
      },
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.1,
        release: 0.3
      }
    }).connect(this.delay);
    
    // Spring synth - bouncy and energetic
    this.springSynth = new Tone.MonoSynth({
      oscillator: {
        type: "square"
      },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0.2,
        release: 0.1
      },
      filter: {
        Q: 8,
        type: "bandpass",
        rolloff: -12
      },
      filterEnvelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.8,
        release: 0.1,
        baseFrequency: 600,
        octaves: 3,
        exponent: 1
      }
    }).connect(this.chorus);
    
    // Platform break synth - noise burst
    this.breakSynth = new Tone.NoiseSynth({
      noise: {
        type: "brown"
      },
      envelope: {
        attack: 0.001,
        decay: 0.15,
        sustain: 0,
        release: 0.1
      }
    }).connect(this.reverb);
    
    // Game over synth - descending doom
    this.gameOverSynth = new Tone.MonoSynth({
      oscillator: {
        type: "sawtooth"
      },
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.4,
        release: 1.5
      },
      filter: {
        Q: 2,
        type: "lowpass",
        rolloff: -24
      },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.3,
        release: 1.5,
        baseFrequency: 1000,
        octaves: 4,
        exponent: 2
      }
    }).connect(this.reverb);
    
    // Background ambient synth
    this.ambientSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 2,
        decay: 1,
        sustain: 0.8,
        release: 2
      },
      modulation: {
        type: "square"
      },
      modulationEnvelope: {
        attack: 0.5,
        decay: 0.2,
        sustain: 0.3,
        release: 0.5
      }
    }).connect(this.reverb);
    
    this.ambientSynth.volume.value = -20;
  }
  
  async init() {
    await Tone.start();
    await this.reverb.ready;
  }
  
  playJump(velocity = 0.8) {
    try {
      // Stop any currently playing jump sound
      this.jumpSynth.triggerRelease();
      
      const now = Tone.now() + 0.01; // Small offset to prevent timing conflicts
      const baseNote = "C4";
      const endNote = "G4";
      
      // Pitch sweep
      this.jumpSynth.triggerAttack(baseNote, now, velocity);
      this.jumpSynth.frequency.rampTo(Tone.Frequency(endNote).toFrequency(), 0.1, now);
      this.jumpSynth.triggerRelease(now + 0.15);
    } catch (e) {
      console.warn('Jump sound error:', e);
    }
  }
  
  playLand(velocity = 0.7) {
    try {
      const notes = ["C2", "C1"];
      const now = Tone.now() + 0.01;
      
      notes.forEach((note, i) => {
        this.landSynth.triggerAttackRelease(note, "16n", now + i * 0.01, velocity - i * 0.2);
      });
    } catch (e) {
      console.warn('Land sound error:', e);
    }
  }
  
  playCoin() {
    try {
      const now = Tone.now() + 0.01;
      const notes = ["C5", "E5", "G5", "C6"];
      
      notes.forEach((note, i) => {
        this.coinSynth.triggerAttackRelease(note, "32n", now + i * 0.03, 0.6);
      });
    } catch (e) {
      console.warn('Coin sound error:', e);
    }
  }
  
  playSpring() {
    try {
      // Stop any currently playing spring sound
      this.springSynth.triggerRelease();
      
      const now = Tone.now() + 0.01;
      const notes = ["C4", "G4", "C5", "G5", "C6"];
      
      // Fast arpeggio
      notes.forEach((note, i) => {
        this.springSynth.triggerAttackRelease(note, "32n", now + i * 0.02, 0.8);
      });
      
      // Add a slide effect
      this.springSynth.frequency.rampTo(2000, 0.2, now);
      this.springSynth.frequency.rampTo(400, 0.1, now + 0.2);
    } catch (e) {
      console.warn('Spring sound error:', e);
    }
  }
  
  playBreak() {
    try {
      const now = Tone.now() + 0.01;
      this.breakSynth.triggerAttackRelease("8n", now, 0.9);
      
      // Add some pitched elements for crunch
      this.landSynth.triggerAttackRelease("G1", "32n", now, 0.5);
      this.landSynth.triggerAttackRelease("D#1", "32n", now + 0.02, 0.4);
    } catch (e) {
      console.warn('Break sound error:', e);
    }
  }
  
  playGameOver() {
    try {
      // Stop any currently playing game over sound
      this.gameOverSynth.triggerRelease();
      
      const now = Tone.now() + 0.01;
      const notes = ["C3", "G2", "Eb2", "C2"];
      
      notes.forEach((note, i) => {
        this.gameOverSynth.triggerAttackRelease(note, 0.4, now + i * 0.3, 0.7 - i * 0.1);
      });
    } catch (e) {
      console.warn('Game over sound error:', e);
    }
  }
  
  playAmbientChord(notes = ["C3", "E3", "G3", "B3"], duration = 4) {
    try {
      const now = Tone.now() + 0.01;
      this.ambientSynth.triggerAttackRelease(notes, duration, now, 0.3);
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  }
  
  playPowerUp() {
    try {
      const now = Tone.now() + 0.01;
      const notes = ["C4", "E4", "G4", "B4", "E5"];
      
      // Ascending arpeggio with delay
      notes.forEach((note, i) => {
        this.coinSynth.triggerAttackRelease(note, "16n", now + i * 0.05, 0.8);
      });
      
      // Add a final flourish
      setTimeout(() => {
        try {
          this.jumpSynth.triggerAttackRelease("C6", "8n", Tone.now() + 0.01, 0.4);
        } catch (e) {
          console.warn('Power-up flourish error:', e);
        }
      }, 300);
    } catch (e) {
      console.warn('Power-up sound error:', e);
    }
  }
  
  setVolume(volume) {
    this.masterVolume.volume.value = Tone.gainToDb(volume);
  }
  
  mute() {
    this.masterVolume.mute = true;
  }
  
  unmute() {
    this.masterVolume.mute = false;
  }
}