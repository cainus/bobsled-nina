import type { Game } from './Game';

export class SoundManager {
  private game: Game;
  private ctx: AudioContext | null = null;

  // Sliding sound nodes
  private slidingGain: GainNode | null = null;
  private slidingFilter: BiquadFilterNode | null = null;
  private slidingSource: AudioBufferSourceNode | null = null;
  private slidingPlaying = false;

  // Wind sound nodes
  private windGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windActive = false;

  constructor(game: Game) {
    this.game = game;
  }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ensureContext();
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  startSliding() {
    if (this.slidingPlaying) return;
    const ctx = this.ensureContext();

    const buffer = this.createNoiseBuffer(2);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Band-pass filter to shape noise into a sliding/hissing sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.12;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.slidingSource = source;
    this.slidingFilter = filter;
    this.slidingGain = gain;
    this.slidingPlaying = true;
  }

  stopSliding() {
    if (!this.slidingPlaying || !this.slidingSource) return;
    this.slidingSource.stop();
    this.slidingSource.disconnect();
    this.slidingSource = null;
    this.slidingFilter = null;
    this.slidingGain = null;
    this.slidingPlaying = false;
  }

  setSlidingMuted(muted: boolean) {
    if (this.slidingGain) {
      this.slidingGain.gain.value = muted ? 0 : 0.12;
    }
  }

  updateSlidingPitch(speed: number) {
    if (this.slidingFilter) {
      // Higher speed = higher pitched sliding
      this.slidingFilter.frequency.value = 600 + (speed / 55) * 600;
    }
  }

  startWind() {
    if (this.windActive) return;
    const ctx = this.ensureContext();

    const buffer = this.createNoiseBuffer(3);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Low-pass filter for a deep howling wind
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1.5;

    // Slow modulation for gusting effect
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    // Fade in
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2);

    this.windSource = source;
    this.windGain = gain;
    this.windActive = true;
  }

  reset() {
    this.stopSliding();
    if (this.windSource) {
      this.windSource.stop();
      this.windSource.disconnect();
      this.windSource = null;
      this.windGain = null;
    }
    this.windActive = false;
  }
}
