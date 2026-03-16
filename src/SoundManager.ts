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

  // Audio sample buffers (loaded from files)
  private growlBuffers: AudioBuffer[] = [];
  private growlsLoaded = false;
  private gruntBuffers: AudioBuffer[] = [];
  private gruntsLoaded = false;

  // Waterfall ambient sound
  private waterfallSource: AudioBufferSourceNode | null = null;
  private waterfallGain: GainNode | null = null;
  private waterfallActive = false;

  constructor(game: Game) {
    this.game = game;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  resumeCtx() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
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

  async loadGrunts() {
    const ctx = this.ensureContext();
    const files = ['/sounds/grunt1.mp3', '/sounds/grunt2.mp3', '/sounds/grunt3.mp3'];
    for (const file of files) {
      try {
        const response = await fetch(file);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.gruntBuffers.push(audioBuffer);
      } catch {
        // Silently skip failed loads
      }
    }
    this.gruntsLoaded = this.gruntBuffers.length > 0;
  }

  playGrunt() {
    if (!this.gruntsLoaded) return;
    const ctx = this.ensureContext();
    const buffer = this.gruntBuffers[Math.floor(Math.random() * this.gruntBuffers.length)];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Pitch up to sound younger, and only play first ~150ms
    source.playbackRate.value = 1.4 + Math.random() * 0.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.18);
  }

  playLand() {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Low thump — short burst of low frequency
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playSplash() {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    // Short burst of filtered noise — bandpass at ~2000Hz for watery sound
    const buffer = this.createNoiseBuffer(0.2);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + 0.15);
  }

  playCollect() {
    const ctx = this.ensureContext();
    // Quick sparkly chime — two sine tones in rapid succession
    const now = ctx.currentTime;
    const notes = [1200, 1600, 2000];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const gain = ctx.createGain();
      const start = now + i * 0.04;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  async loadGrowls() {
    const ctx = this.ensureContext();
    const files = ['/sounds/growl1.mp3', '/sounds/growl2.mp3', '/sounds/growl3.mp3'];
    for (const file of files) {
      try {
        const response = await fetch(file);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.growlBuffers.push(audioBuffer);
      } catch {
        // Silently skip failed loads
      }
    }
    this.growlsLoaded = this.growlBuffers.length > 0;
  }

  playGrowl() {
    if (!this.growlsLoaded) return;
    const ctx = this.ensureContext();
    const buffer = this.growlBuffers[Math.floor(Math.random() * this.growlBuffers.length)];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.7;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
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

  // Thrash metal music
  private thrashSource: AudioBufferSourceNode | null = null;
  private thrashGain: GainNode | null = null;
  private thrashPlaying = false;

  private renderThrashBuffer(): AudioBuffer {
    const ctx = this.ensureContext();
    const sampleRate = ctx.sampleRate;
    const bpm = 340;
    const noteLen = 60 / bpm;
    // E2-based thrash riff with palm mutes and power chords — fast 16th note feel
    const riffNotes = [82.4, 82.4, 98, 82.4, 110, 130.8, 82.4, 98, 73.4, 82.4, 110, 123.5];
    const riffDuration = riffNotes.length * noteLen;
    const totalSamples = Math.ceil(riffDuration * sampleRate);
    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let noteIdx = 0; noteIdx < riffNotes.length; noteIdx++) {
      const freq = riffNotes[noteIdx];
      const fifth = freq * 1.5;
      const startSample = Math.floor(noteIdx * noteLen * sampleRate);
      const noteSamples = Math.floor(noteLen * sampleRate);
      const isPalmMute = noteIdx % 3 === 0;
      const noteDur = isPalmMute ? noteSamples * 0.5 : noteSamples * 0.9;

      for (let s = 0; s < noteSamples && startSample + s < totalSamples; s++) {
        const t = s / sampleRate;
        // Envelope — fast attack, variable sustain
        let env = 1;
        if (s < 80) env = s / 80;
        if (s > noteDur) env = Math.max(0, 1 - (s - noteDur) / (noteSamples * 0.1));

        // Guitar: square-ish wave + fifth, distorted
        let guitar = Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * t * 2);
        guitar += 0.6 * Math.sin(2 * Math.PI * fifth * t);
        // Hard clip distortion
        guitar = Math.tanh(guitar * 3) * 0.35;

        // Kick drum every other note
        let kick = 0;
        if (s < sampleRate * 0.04) {
          const kickT = s / sampleRate;
          kick = Math.sin(2 * Math.PI * (150 - kickT * 2000) * kickT) * 0.5 * (1 - kickT * 25);
        }

        // Snare on off-beats
        let snare = 0;
        const snareOffset = Math.floor(noteSamples / 2);
        const snareS = s - snareOffset;
        if (noteIdx % 2 === 1 && snareS > 0 && snareS < sampleRate * 0.04) {
          snare = (Math.random() * 2 - 1) * 0.25 * (1 - snareS / (sampleRate * 0.04));
        }

        // Hi-hat — constant 16th note chatter
        let hihat = 0;
        const hhInterval = Math.floor(noteSamples / 2);
        const hhS = s % hhInterval;
        if (hhS < sampleRate * 0.015) {
          hihat = (Math.random() * 2 - 1) * 0.08 * (1 - hhS / (sampleRate * 0.015));
        }

        data[startSample + s] = (guitar * env + kick + snare + hihat);
      }
    }

    return buffer;
  }

  startThrash() {
    if (this.thrashPlaying) return;
    this.thrashPlaying = true;
    const ctx = this.ensureContext();

    const buffer = this.renderThrashBuffer();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = 1.3;

    const gain = ctx.createGain();
    gain.gain.value = 0.5;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.thrashSource = source;
    this.thrashGain = gain;
  }

  stopThrash() {
    if (!this.thrashPlaying) return;
    this.thrashPlaying = false;
    if (this.thrashSource) {
      this.thrashSource.stop();
      this.thrashSource.disconnect();
      this.thrashSource = null;
    }
    if (this.thrashGain) {
      this.thrashGain.disconnect();
      this.thrashGain = null;
    }
  }

  // Snowmobile motor
  private motorSource: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private motorPlaying = false;

  startMotor() {
    if (this.motorPlaying) return;
    this.motorPlaying = true;
    const ctx = this.ensureContext();

    // Low rumbling motor — sawtooth with LFO modulation
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;

    // Engine RPM wobble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    // Low-pass to remove harshness
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    this.motorSource = osc;
    this.motorGain = gain;
  }

  setMotorPitch(high: boolean) {
    if (this.motorSource) {
      this.motorSource.frequency.linearRampToValueAtTime(
        high ? 90 : 55,
        this.ctx!.currentTime + 0.1
      );
    }
  }

  stopMotor() {
    if (!this.motorPlaying) return;
    this.motorPlaying = false;
    if (this.motorSource) {
      this.motorSource.stop();
      this.motorSource.disconnect();
      this.motorSource = null;
    }
    if (this.motorGain) {
      this.motorGain.disconnect();
      this.motorGain = null;
    }
  }

  setWindVolume(vol: number) {
    if (this.windGain) {
      this.windGain.gain.linearRampToValueAtTime(vol, this.ctx!.currentTime + 0.5);
    }
  }

  updateWaterfallSound(nearestWaterfallZ: number | null) {
    if (nearestWaterfallZ === null) {
      this.stopWaterfall();
      return;
    }

    // Start looping waterfall noise if not active
    if (!this.waterfallActive) {
      const ctx = this.ensureContext();
      const buffer = this.createNoiseBuffer(3);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Low-pass filtered noise for deep roar
      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 600;
      lpFilter.Q.value = 0.5;

      // Add a second bandpass for some mid-range body
      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.value = 300;
      bpFilter.Q.value = 0.3;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      source.connect(lpFilter);
      lpFilter.connect(bpFilter);
      bpFilter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.waterfallSource = source;
      this.waterfallGain = gain;
      this.waterfallActive = true;
    }

    // Volume based on distance — loud when close, fades over ~80 units
    if (this.waterfallGain) {
      const dist = Math.abs(nearestWaterfallZ);
      const volume = Math.max(0, 1 - dist / 80) ** 1.5 * 0.5;
      this.waterfallGain.gain.value = volume;
    }
  }

  private stopWaterfall() {
    if (this.waterfallSource) {
      this.waterfallSource.stop();
      this.waterfallSource.disconnect();
      this.waterfallSource = null;
      this.waterfallGain = null;
    }
    this.waterfallActive = false;
  }

  reset() {
    this.stopSliding();
    this.stopThrash();
    this.stopMotor();
    this.stopWaterfall();
    if (this.windSource) {
      this.windSource.stop();
      this.windSource.disconnect();
      this.windSource = null;
      this.windGain = null;
    }
    this.windActive = false;
  }
}
