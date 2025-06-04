import * as Tone from 'tone';

// Effects chain
const chorus = new Tone.Chorus({
  frequency: 0.5, delayTime: 3.5, depth: 0.7, wet: 0.5
}).toDestination();

const reverb = new Tone.Reverb({
  decay: 2.5, wet: 0.2
}).toDestination();

// Main synthesizer
class ProphetSynth extends Tone.Synth {
  constructor(options) {
    super(Object.assign({
      oscillator: { type: 'sawtooth', count: 2, spread: 20 },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.8, release: 1.2 }
    }, options));

    this._driftLfo = new Tone.LFO({ frequency: 0.1, min: -2, max: 2 }).start();
    this._driftLfo.connect(this.oscillator.detune);

    this._filter = new Tone.Filter({ type: 'lowpass', frequency: 2000, rolloff: -24, Q: 2 });

    this._filterEnvelope = new Tone.FrequencyEnvelope({
      attack: 0.5, decay: 0.3, sustain: 0.4, release: 1.5,
      baseFrequency: 200, octaves: 4, exponent: 2
    });

    this._filterLfo = new Tone.LFO({
      frequency: 0.5,
      min: this._filter.frequency.value - 400,
      max: this._filter.frequency.value + 400
    }).start();
    this._filterLfo.connect(this._filter.frequency);

    this.connect(this._filter);
  }
}

const mainSynth = new Tone.PolySynth(ProphetSynth).connect(chorus).connect(reverb);

export {
  backgroundSynth,
  metronomeSynth,
  mainSynth
}; 
