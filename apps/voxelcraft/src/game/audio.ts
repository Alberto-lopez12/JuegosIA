/**
 * 100% procedural Web Audio API sound synthesizer (zero external audio files).
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainTargetGain = 0;
  private portalOscA: OscillatorNode | null = null;
  private portalOscB: OscillatorNode | null = null;
  private portalGain: GainNode | null = null;
  private portalTargetGain = 0;
  private jukeboxTimer: number | null = null;
  private jukeboxStep = 0;
  public jukeboxPlaying = false;
  public muted = false;
  public volume = 0.8; // 0..1

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0.001) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
    return this.ctx;
  }

  private get output(): AudioNode {
    return this.masterGain ?? this.ctx!.destination;
  }

  public setVolume(percent: number): void {
    this.volume = Math.max(0, Math.min(1, percent / 100));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private jitter(base: number, amount = 0.08): number {
    return base * (1 + (Math.random() * 2 - 1) * amount);
  }

  public playFootstep(material: 'grass' | 'stone' | 'sand' | 'wood' | 'water' = 'grass'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const freqMap = { grass: 650, stone: 1350, sand: 1900, wood: 480, water: 900 };
    filter.frequency.setValueAtTime(this.jitter(freqMap[material], 0.12), now);
    filter.Q.value = material === 'stone' ? 3.5 : 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.08);
  }

  public playMineHit(isStone = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(this.jitter(isStone ? 1600 : 750, 0.12), now);
    filter.Q.value = isStone ? 4 : 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.08);
  }

  public playBlockBreak(isStone = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Noise crunch
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.jitter(isStone ? 1800 : 950, 0.1), now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.2);

    // Low thud
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(isStone ? 220 : 140, 0.1), now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(og).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playBlockPlace(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(190, 0.08), now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = this.jitter(540, 0.08);
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.65, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playSplash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.25);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.28);
  }

  public playHurt(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playMobHit(
    kind: 'pig' | 'zombie' | 'sheep' | 'skeleton' | 'villager' | 'zombie_piglin' | 'ghast' | 'blaze'
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    if (kind === 'skeleton') {
      osc.type = 'square';
      const startFreq = this.jitter(640, 0.12);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.45, now + 0.09);
    } else if (kind === 'sheep') {
      osc.type = 'triangle';
      const startFreq = this.jitter(290, 0.08);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.85, now + 0.16);
    } else if (kind === 'villager') {
      osc.type = 'sawtooth';
      const startFreq = this.jitter(170, 0.06);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.78, now + 0.14);
    } else if (kind === 'zombie_piglin') {
      osc.type = 'sawtooth';
      const startFreq = this.jitter(240, 0.12);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.55, now + 0.16);
    } else if (kind === 'ghast') {
      osc.type = 'sine';
      const startFreq = this.jitter(820, 0.12);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.45, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.6, now + 0.28);
    } else if (kind === 'blaze') {
      osc.type = 'square';
      const startFreq = this.jitter(520, 0.14);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.35, now + 0.13);
    } else {
      osc.type = kind === 'pig' ? 'triangle' : 'sawtooth';
      const startFreq = kind === 'pig' ? this.jitter(360, 0.1) : this.jitter(115, 0.1);
      const endFreq = kind === 'pig' ? startFreq * 1.45 : startFreq * 0.65;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.15);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'ghast' ? 0.3 : 0.17));

    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + (kind === 'ghast' ? 0.32 : 0.18));
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(760, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playEat(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.08;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = this.jitter(1200, 0.15);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      src.connect(filter).connect(gain).connect(this.output);
      src.start(t);
      src.stop(t + 0.065);
    }
  }

  public playChest(open: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Filtered wooden creak noise
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(open ? 240 : 410, now);
    filter.frequency.exponentialRampToValueAtTime(open ? 420 : 190, now + 0.22);
    filter.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.25);

    // Subtle latch click
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(open ? 160 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(open ? 230 : 85, now + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.11, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(og).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playBowShoot(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // String twang
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(310, 0.08), now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.14, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(og).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.16);

    // Arrow whoosh
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1600, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.13);
  }

  public playArrowHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.jitter(620, 0.1), now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playCriticalHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(480, now);
    osc1.frequency.exponentialRampToValueAtTime(980, now + 0.09);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.16, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(g1).connect(this.output);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(180, now);
    osc2.frequency.exponentialRampToValueAtTime(70, now + 0.12);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.22, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc2.connect(g2).connect(this.output);
    osc2.start(now);
    osc2.stop(now + 0.14);
  }

  public playBubblePop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = this.jitter(420, 0.15);
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.1, now + 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playTrade(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(this.output);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playBedSleep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [261.63, 329.63, 392.0];
    chord.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(this.output);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  /**
   * Smoothly controls continuous procedural rain ambient noise (0 = silent, 1 = full outdoor storm).
   */
  public updateRainAudio(intensity: number, indoors = false): void {
    const clamped = this.muted ? 0 : Math.max(0, Math.min(1, intensity));
    if (clamped <= 0.005) {
      if (this.rainGain && this.ctx) {
        this.rainGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.18);
      }
      this.rainTargetGain = 0;
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    if (!this.rainSource) {
      // Create a 2-second smooth pink-ish rain loop buffer
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        ch[i] = (b0 + b1 + b2 + white * 0.18) * 0.45;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.65;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      src.connect(filter).connect(gain).connect(this.output);
      src.start();
      this.rainSource = src;
      this.rainFilter = filter;
      this.rainGain = gain;
    }

    const targetGain = clamped * (indoors ? 0.032 : 0.095);
    const targetFreq = indoors ? 460 : 1250;
    if (Math.abs(targetGain - this.rainTargetGain) > 0.002 || this.rainFilter) {
      this.rainTargetGain = targetGain;
      this.rainGain?.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.25);
      this.rainFilter?.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.25);
    }
  }

  public playFlintAndSteel(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2600, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(hp).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.1);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.1, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(og).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playPortalActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [92, 138, 220, 330];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f * 0.7, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.35, now + 0.9);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(750, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
      osc.connect(filt).connect(g).connect(this.output);
      osc.start(now);
      osc.stop(now + 1.08);
    });
  }

  public playPortalTravel(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.7);
    osc.frequency.exponentialRampToValueAtTime(160, now + 1.15);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 35;
    lfo.connect(lfoGain).connect(osc.frequency);

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(520, now);
    filt.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filt).connect(gain).connect(this.output);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.22);
    lfo.stop(now + 1.22);
  }

  public playLavaBubble(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f0 = this.jitter(75, 0.2);
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 2.1, now + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playFireSizzle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.25);
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(filter).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.3);
  }

  public playGhastScream(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.55);

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(950, now);
    filt.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(filt).connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(55, now + 0.65);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.32, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    src.connect(lp).connect(ng).connect(this.output);
    src.start(now);
    src.stop(now + 0.72);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.28, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(og).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.56);
  }

  /**
   * Smooth deep eerie hum when inside The Nether or standing near a Nether Portal.
   */
  public updatePortalAmbient(intensity: number): void {
    const clamped = this.muted ? 0 : Math.max(0, Math.min(1, intensity));
    if (clamped <= 0.005) {
      if (this.portalGain && this.ctx) {
        this.portalGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      }
      this.portalTargetGain = 0;
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.portalOscA) {
      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.value = 55;
      const oscB = ctx.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.value = 57.2; // eerie slow beating harmonic

      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 180;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      oscA.connect(filt);
      oscB.connect(filt);
      filt.connect(gain).connect(this.output);
      oscA.start();
      oscB.start();

      this.portalOscA = oscA;
      this.portalOscB = oscB;
      this.portalGain = gain;
    }

    const target = clamped * 0.055;
    if (Math.abs(target - this.portalTargetGain) > 0.0015) {
      this.portalTargetGain = target;
      this.portalGain?.gain.setTargetAtTime(target, ctx.currentTime, 0.3);
    }
  }

  public playDoorToggle(open: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(open ? 190 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(open ? 310 : 145, now + 0.085);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playTntFuse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3400, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.42);
    bp.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(bp).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.46);
  }

  public playShear(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2800, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    src.connect(hp).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.08);
  }

  public playBucket(fill: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fill ? 260 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(fill ? 560 : 210, now + 0.13);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playHoeTill(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(920, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(lp).connect(gain).connect(this.output);
    src.start(now);
    src.stop(now + 0.12);
  }

  public playBoneMeal(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, i) => {
      const t = now + i * 0.04;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain).connect(this.output);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playAnvilRepair(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [420, 895, 1340];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(this.jitter(freq, 0.03), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + 0.38);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain).connect(this.output);
      osc.start(now);
      osc.stop(now + 0.44);
    });
  }

  public playNoteBlock(pitchIndex: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const semitone = Math.max(0, Math.min(24, Math.floor(pitchIndex)));
    const freq = 185 * Math.pow(2, semitone / 12);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, now);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.16, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.05, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g1).connect(this.output);
    overtone.connect(g2).connect(this.output);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.38);
    overtone.stop(now + 0.24);
  }

  public playSlimeBounce(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.24);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain).connect(this.output);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  /**
   * Toggles a relaxing procedural Web Audio chiptune melody loop for the Jukebox block.
   */
  public toggleJukebox(): boolean {
    if (this.jukeboxPlaying) {
      this.stopJukebox();
      return false;
    }
    const ctx = this.ensureContext();
    if (!ctx) return false;
    this.jukeboxPlaying = true;
    this.jukeboxStep = 0;

    // Gentle peaceful C-major / A-minor chiptune arpeggio & melody
    const melody: Array<[number, number]> = [
      [523.25, 261.63],
      [659.25, 0],
      [783.99, 329.63],
      [659.25, 0],
      [587.33, 293.66],
      [659.25, 0],
      [523.25, 220.0],
      [440.0, 0],
      [493.88, 246.94],
      [587.33, 0],
      [659.25, 261.63],
      [783.99, 0],
      [880.0, 220.0],
      [783.99, 0],
      [659.25, 196.0],
      [523.25, 0],
    ];

    const playStep = () => {
      if (!this.jukeboxPlaying) return;
      const c = this.ensureContext();
      if (!c) return;
      const now = c.currentTime;
      const [lead, bass] = melody[this.jukeboxStep % melody.length];
      this.jukeboxStep++;

      if (lead > 0) {
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(lead, now);
        const g = c.createGain();
        g.gain.setValueAtTime(0.065, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.connect(g).connect(this.output);
        osc.start(now);
        osc.stop(now + 0.36);
      }
      if (bass > 0) {
        const oscB = c.createOscillator();
        oscB.type = 'sine';
        oscB.frequency.setValueAtTime(bass, now);
        const gB = c.createGain();
        gB.gain.setValueAtTime(0.055, now);
        gB.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
        oscB.connect(gB).connect(this.output);
        oscB.start(now);
        oscB.stop(now + 0.58);
      }
    };

    playStep();
    this.jukeboxTimer = window.setInterval(playStep, 380);
    return true;
  }

  public stopJukebox(): void {
    this.jukeboxPlaying = false;
    if (this.jukeboxTimer !== null) {
      window.clearInterval(this.jukeboxTimer);
      this.jukeboxTimer = null;
    }
  }

  public dispose(): void {
    this.stopJukebox();
    try {
      this.rainSource?.stop();
      this.rainSource?.disconnect();
      this.portalOscA?.stop();
      this.portalOscA?.disconnect();
      this.portalOscB?.stop();
      this.portalOscB?.disconnect();
    } catch {
      // ignore
    }
    this.rainSource = null;
    this.rainGain = null;
    this.rainFilter = null;
    this.portalOscA = null;
    this.portalOscB = null;
    this.portalGain = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
