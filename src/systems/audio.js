export class SoundDesign {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineGain = null;
    this.rotorGain = null;
    this.engineOsc = null;
    this.rotorOsc = null;
    this.rotorPulse = null;
    this.noiseGain = null;
    this.noiseSource = null;
    this.started = false;
  }

  ensure() {
    if (this.started) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.context.destination);

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.14;
    this.engineGain.connect(this.master);

    this.engineOsc = this.context.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 72;
    const engineFilter = this.context.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 360;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineOsc.start();

    this.rotorGain = this.context.createGain();
    this.rotorGain.gain.value = 0.28;
    this.rotorGain.connect(this.master);

    this.rotorOsc = this.context.createOscillator();
    this.rotorOsc.type = "triangle";
    this.rotorOsc.frequency.value = 23;
    const rotorFilter = this.context.createBiquadFilter();
    rotorFilter.type = "lowpass";
    rotorFilter.frequency.value = 120;
    this.rotorOsc.connect(rotorFilter);
    rotorFilter.connect(this.rotorGain);
    this.rotorOsc.start();

    this.rotorPulse = this.context.createOscillator();
    this.rotorPulse.type = "square";
    this.rotorPulse.frequency.value = 7.2;
    const pulseGain = this.context.createGain();
    pulseGain.gain.value = 0.06;
    this.rotorPulse.connect(pulseGain);
    pulseGain.connect(this.master);
    this.rotorPulse.start();

    this.noiseGain = this.context.createGain();
    this.noiseGain.gain.value = 0.025;
    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 520;
    noiseFilter.Q.value = 0.7;
    this.noiseSource = this.createNoiseSource();
    this.noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
    this.noiseSource.start();

    this.started = true;
  }

  resume() {
    this.ensure();
    this.context?.resume();
  }

  update({ mode, altitude, speed, heat }) {
    if (!this.started) return;

    const now = this.context.currentTime;
    const lift = Math.min(1, altitude / 22);
    const throttle = Math.min(1, speed / 46);
    const gunnerBoost = mode === "Gunner" ? 0.08 : 0;

    this.engineOsc.frequency.setTargetAtTime(68 + throttle * 34 + lift * 12, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.11 + throttle * 0.1 + gunnerBoost, now, 0.1);
    this.rotorOsc.frequency.setTargetAtTime(20 + lift * 8 + throttle * 5, now, 0.1);
    this.rotorPulse.frequency.setTargetAtTime(6.2 + lift * 2.6 + throttle * 1.6, now, 0.1);
    this.rotorGain.gain.setTargetAtTime(0.22 + lift * 0.11, now, 0.12);
    this.noiseGain.gain.setTargetAtTime(0.02 + throttle * 0.03 + heat * 0.0003, now, 0.12);
  }

  fireGun() {
    if (!this.started) return;
    const now = this.context.currentTime;

    const shot = this.context.createOscillator();
    shot.type = "square";
    shot.frequency.setValueAtTime(92, now);
    shot.frequency.exponentialRampToValueAtTime(38, now + 0.045);

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 980;
    filter.Q.value = 1.6;

    shot.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    shot.start(now);
    shot.stop(now + 0.08);

    this.noiseBurst(0.16, 1300, 0.06);
  }

  hit() {
    if (!this.started) return;
    this.blip(170, 55, 0.16, 0.2, "sawtooth");
  }

  board() {
    if (!this.started) return;
    this.blip(440, 660, 0.12, 0.12, "square");
  }

  missionComplete() {
    if (!this.started) return;
    this.blip(330, 660, 0.38, 0.18, "triangle");
    window.setTimeout(() => this.blip(495, 880, 0.34, 0.14, "triangle"), 160);
  }

  warning() {
    if (!this.started) return;
    this.blip(180, 120, 0.24, 0.13, "sawtooth");
  }

  blip(startFreq, endFreq, duration, volume, type) {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noiseBurst(volume, frequency, duration) {
    const now = this.context.currentTime;
    const noise = this.createNoiseSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  createNoiseSource() {
    const bufferSize = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      output[i] = Math.random() * 2 - 1;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }
}
