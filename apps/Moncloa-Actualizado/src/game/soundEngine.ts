// Procedural Web Audio Synthesizer for Five Nights in Moncloa
// Generates industrial office drones, hydraulic door slams, halogen buzz,
// CRT camera static, Pedro's deep laugh, Montero's kitchen clatter,
// Abascal's hallway sprint & door bang, Toreador March music box,
// animatronic jumpscare roar, and 6 AM grandfather clock chime.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private ambientGain: GainNode | null = null;
  private lightHumGain: GainNode | null = null;
  private isAmbientRunning: boolean = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.04, this.ctx.currentTime, 0.05);
    }
    if (this.lightHumGain && this.ctx && muted) {
      this.lightHumGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startAmbientDrone() {
    const ctx = this.ensureContext();
    if (!ctx || this.isAmbientRunning) return;
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.value = 55; // Low 55Hz industrial fan hum
      osc2.type = 'triangle';
      osc2.frequency.value = 110.5;

      filter.type = 'lowpass';
      filter.frequency.value = 160;

      gain.gain.value = this.muted ? 0 : 0.04;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      this.ambientGain = gain;

      // Halogen light hum bus
      const humOsc = ctx.createOscillator();
      const humGain = ctx.createGain();
      humOsc.type = 'sawtooth';
      humOsc.frequency.value = 120;
      humGain.gain.value = 0;
      humOsc.connect(humGain);
      humGain.connect(ctx.destination);
      humOsc.start();
      this.lightHumGain = humGain;

      this.isAmbientRunning = true;
    } catch {
      // Ignore audio autoplay errors before interaction
    }
  }

  public setLightHum(active: boolean) {
    if (!this.ctx || !this.lightHumGain) return;
    const target = active && !this.muted ? 0.035 : 0;
    this.lightHumGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  public playDoorSlam(closed: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Hydraulic hiss + heavy metallic thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(closed ? 145 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(closed ? 32 : 165, now + 0.24);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  }

  public playJammedBuzzer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(88, now);
    osc.frequency.setValueAtTime(72, now + 0.09);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playWindowScareSting() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Classic FNAF dissonant metallic violin/piano scare chord
    const freqs = [233.08, 311.13, 329.63, 466.16, 622.25];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.86);
    });
  }

  public playCameraBlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.setValueAtTime(1560, now + 0.03);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playMonitorFlip(opening: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(opening ? 240 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 580 : 190, now + 0.14);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playNoseHonk() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(590, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playPedroLaugh() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 3 deep reverberating "Hoh... hoh... hoh..." bursts
    [0, 0.22, 0.45].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const baseFreq = 115 - i * 8;
      osc.frequency.setValueAtTime(baseFreq, now + offset);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, now + offset + 0.18);

      gain.gain.setValueAtTime(0.16, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  }

  public playKitchenClatter() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Metallic pots & pans clanking
    [0, 0.12, 0.28, 0.41].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(480 + idx * 190, now + offset);
      osc.frequency.exponentialRampToValueAtTime(180, now + offset + 0.09);
      gain.gain.setValueAtTime(0.11, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  }

  public playFoxySprint() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Rapid metallic footsteps sprinting down the corridor
    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 + (i % 2) * 35, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
      gain.gain.setValueAtTime(0.18 + i * 0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.11);
    }
  }

  public playFoxyDoorBang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 3 heavy metallic bangs against the steel security door
    [0, 0.26, 0.54].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(92, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.2);
      gain.gain.setValueAtTime(0.38, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.23);
    });
  }

  public playPowerDown() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(0, now, 0.1);
    }
    this.setLightHum(false);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.4);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  public playToreadorNote(noteIndex: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Carmen Toreador Music Box melody notes
    const melody = [
      523.25, 587.33, 523.25, 440.0, 440.0, 440.0, 392.0, 440.0, 466.16, 440.0,
      392.0, 440.0, 349.23, 523.25,
    ];
    const freq = melody[noteIndex % melody.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playJumpscareScream() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [190, 285, 415, 580, 830, 1140];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.18, now + 0.25);
      osc.frequency.linearRampToValueAtTime(f * 0.88, now + 0.75);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.86);
    });
  }

  public playVictoryChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Westminster Grandfather Clock Chime (E4, G#4, F#4, B3)
    const notes = [
      { f: 329.63, t: 0 },
      { f: 415.3, t: 0.45 },
      { f: 369.99, t: 0.9 },
      { f: 246.94, t: 1.35 },
      { f: 329.63, t: 2.0 },
      { f: 369.99, t: 2.45 },
      { f: 415.3, t: 2.9 },
      { f: 329.63, t: 3.35 },
    ];
    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.22, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.68);
    });
  }
}

export const soundEngine = new SoundEngine();
