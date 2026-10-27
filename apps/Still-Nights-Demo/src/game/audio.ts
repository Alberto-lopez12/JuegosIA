import {
  FREDDY_VENT_LAUGH_DELAY_MS,
  GameAudioEvent,
  PHONE_RING_GAP_MS,
  PHONE_RING_TOTAL_LOOPS,
} from './rules';

export const AUDIO_PATHS = {
  jumpscare: './assets/aistudio/five-nights-at-freddys-full-scream-sound_2_034247c5.mp3',
  nightmareJumpscare: './assets/aistudio/Jumpscare_nightmare_0a94c193.mp3',
  footsteps: './assets/aistudio/fnaf-1-footsteps_97a4c7c0.mp3',
  nightmareFootsteps: './assets/aistudio/Pasos_nightmare_c38be397.mp3',
  vent: './assets/aistudio/fnaf-2-vent-sound-effect_6c9ae495.mp3',
  freddyLaugh: './assets/aistudio/Risa_Freddy_6c002680.mp3',
  creepyAmbience: './assets/aistudio/creepy-and-unsettling-soundd_6fe1698d.mp3',
  menuMusic: './assets/aistudio/Fnaf_main_menu_music_e590bab0.mp3',
  winSound: './assets/aistudio/Fnaf_win_sound_8121a389.mp3',
  clockTick: './assets/aistudio/clock-tick_750f2ad2.mp3',
  woodHover: './assets/aistudio/Fnaf_madera_sound_6632fadc.mp3',
  woodClick: './assets/aistudio/Fnaf_madera_sound_golpe_4cb5295c.mp3',
  ringingPhone: './assets/aistudio/ringing_phone-mike_koenig-1503628110_a55667cd.mp3',
} as const;

class SoundController {
  private ctx: AudioContext | null = null;
  private muted = false;
  private jumpscareAudio: HTMLAudioElement | null = null;
  private nightmareJumpscareAudio: HTMLAudioElement | null = null;
  private footstepsAudio: HTMLAudioElement | null = null;
  private nightmareFootstepsAudio: HTMLAudioElement | null = null;
  private ventAudio: HTMLAudioElement | null = null;
  private freddyLaughAudio: HTMLAudioElement | null = null;
  private creepyAmbienceAudio: HTMLAudioElement | null = null;
  private menuMusicAudio: HTMLAudioElement | null = null;
  private winSoundAudio: HTMLAudioElement | null = null;
  private clockTickAudio: HTMLAudioElement | null = null;
  private woodHoverAudio: HTMLAudioElement | null = null;
  private woodClickAudio: HTMLAudioElement | null = null;
  private ringingPhoneAudio: HTMLAudioElement | null = null;
  private clockTickFadeTimer: number | null = null;
  private freddyLaughTimers: number[] = [];
  private phoneRingTimers: number[] = [];
  private menuAudioActive = true;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as unknown as { __soundController?: SoundController }).__soundController = this;
      this.jumpscareAudio = new Audio(AUDIO_PATHS.jumpscare);
      this.jumpscareAudio.preload = 'auto';

      this.nightmareJumpscareAudio = new Audio(AUDIO_PATHS.nightmareJumpscare);
      this.nightmareJumpscareAudio.preload = 'auto';

      this.footstepsAudio = new Audio(AUDIO_PATHS.footsteps);
      this.footstepsAudio.preload = 'auto';

      this.nightmareFootstepsAudio = new Audio(AUDIO_PATHS.nightmareFootsteps);
      this.nightmareFootstepsAudio.preload = 'auto';

      this.ventAudio = new Audio(AUDIO_PATHS.vent);
      this.ventAudio.preload = 'auto';

      this.freddyLaughAudio = new Audio(AUDIO_PATHS.freddyLaugh);
      this.freddyLaughAudio.preload = 'auto';
      this.freddyLaughAudio.volume = 0.92;

      // Main menu unsettling static/ambience
      this.creepyAmbienceAudio = new Audio(AUDIO_PATHS.creepyAmbience);
      this.creepyAmbienceAudio.preload = 'auto';
      this.creepyAmbienceAudio.loop = true;
      this.creepyAmbienceAudio.volume = 0.42;

      // Softly-looping FNAF main menu music ("que sea suave, tipo bájale un poco el volumen a la música")
      this.menuMusicAudio = new Audio(AUDIO_PATHS.menuMusic);
      this.menuMusicAudio.preload = 'auto';
      this.menuMusicAudio.loop = true;
      this.menuMusicAudio.volume = 0.16;

      // 6:00 AM Victory Cheer Sound ("Fnaf-win-sound")
      this.winSoundAudio = new Audio(AUDIO_PATHS.winSound);
      this.winSoundAudio.preload = 'auto';
      this.winSoundAudio.volume = 0.92;

      // Clock Tick Sound while the 12:00 AM -> 6:00 AM counter climbs ("Clock-tick")
      this.clockTickAudio = new Audio(AUDIO_PATHS.clockTick);
      this.clockTickAudio.preload = 'auto';
      this.clockTickAudio.loop = true;
      this.clockTickAudio.volume = 0.78;

      // Main Menu Wood Hover Sound ("Fnaf madera sound")
      this.woodHoverAudio = new Audio(AUDIO_PATHS.woodHover);
      this.woodHoverAudio.preload = 'auto';
      this.woodHoverAudio.volume = 0.78;

      // Main Menu Wood Click / Strike Sound ("Fnaf madera sound golpe")
      this.woodClickAudio = new Audio(AUDIO_PATHS.woodClick);
      this.woodClickAudio.preload = 'auto';
      this.woodClickAudio.volume = 0.92;

      // Office Ringing Phone Sound ("ringing_phone-mike_koenig-1503628110", ~4 seconds)
      this.ringingPhoneAudio = new Audio(AUDIO_PATHS.ringingPhone);
      this.ringingPhoneAudio.preload = 'auto';
      this.ringingPhoneAudio.volume = 0.85;
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Ensures main menu background audio loops (BOTH menuMusicAudio and creepyAmbienceAudio)
   * ONLY play on the Main Menu (inMenu === true) and stop completely as soon as the player
   * clicks "Nueva Partida" or "Continuar".
   */
  public ensureBackgroundLoops(inMenu = true) {
    this.menuAudioActive = inMenu;
    if (!inMenu || this.muted) {
      this.stopMenuMusic();
      return;
    }

    if (this.creepyAmbienceAudio) {
      const ambience = this.creepyAmbienceAudio;
      ambience.loop = true;
      ambience.volume = 0.42;
      if (ambience.paused) {
        ambience
          .play()
          .then(() => {
            if (!this.menuAudioActive || this.muted) {
              ambience.pause();
              ambience.currentTime = 0;
            }
          })
          .catch(() => {});
      }
    }

    if (this.menuMusicAudio) {
      const music = this.menuMusicAudio;
      music.loop = true;
      music.volume = 0.17;
      if (music.paused) {
        music
          .play()
          .then(() => {
            if (!this.menuAudioActive || this.muted) {
              music.pause();
              music.currentTime = 0;
            }
          })
          .catch(() => {});
      }
    }
  }

  public stopMenuMusic() {
    this.menuAudioActive = false;
    if (this.menuMusicAudio) {
      this.menuMusicAudio.pause();
      this.menuMusicAudio.currentTime = 0;
    }
    if (this.creepyAmbienceAudio) {
      this.creepyAmbienceAudio.pause();
      this.creepyAmbienceAudio.currentTime = 0;
    }
  }

  public getMenuAudioStatus() {
    return {
      menuAudioActive: this.menuAudioActive,
      menuMusicPaused: this.menuMusicAudio ? this.menuMusicAudio.paused : true,
      creepyAmbiencePaused: this.creepyAmbienceAudio ? this.creepyAmbienceAudio.paused : true,
    };
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      this.stopAll(true);
    } else {
      const isTitle =
        typeof document !== 'undefined' && document.body?.dataset?.state === 'title';
      this.ensureBackgroundLoops(isTitle);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public clearClockTickFade() {
    if (this.clockTickFadeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.clockTickFadeTimer);
      this.clockTickFadeTimer = null;
    }
  }

  public clearFreddyLaughTimers() {
    if (typeof window !== 'undefined') {
      this.freddyLaughTimers.forEach((id) => window.clearTimeout(id));
    }
    this.freddyLaughTimers = [];
  }

  public stopPhoneRingSequence() {
    if (typeof window !== 'undefined') {
      this.phoneRingTimers.forEach((id) => window.clearTimeout(id));
    }
    this.phoneRingTimers = [];
    if (this.ringingPhoneAudio) {
      this.ringingPhoneAudio.onended = null;
      this.ringingPhoneAudio.pause();
      this.ringingPhoneAudio.currentTime = 0;
    }
  }

  /**
   * Plays the 4-second ringing phone audio 3 times in a loop with a 1-second (1000ms) gap
   * between each loop ("este sonido adjunto que dura 4 segundos pero ponlo 3 veces en bucle
   * y con 1 segundo entre bucle y bucle").
   */
  public startPhoneRingSequence(
    onRingCountChange?: (ringNumber: number) => void,
    onSequenceComplete?: () => void
  ) {
    this.stopPhoneRingSequence();
    if (typeof window === 'undefined') {
      onSequenceComplete?.();
      return;
    }

    const playSingleRing = (ringIndex: number) => {
      onRingCountChange?.(ringIndex);

      let handledEnd = false;
      const handleRingFinished = () => {
        if (handledEnd) return;
        handledEnd = true;
        if (this.ringingPhoneAudio) {
          this.ringingPhoneAudio.onended = null;
        }
        if (ringIndex < PHONE_RING_TOTAL_LOOPS) {
          // Wait 1 second (1000ms) between ring loops
          const gapTimer = window.setTimeout(() => {
            playSingleRing(ringIndex + 1);
          }, PHONE_RING_GAP_MS);
          this.phoneRingTimers.push(gapTimer);
        } else {
          // Completed all 3 loops
          onSequenceComplete?.();
        }
      };

      // Safety fallback timer in case audio is muted or browser blocks playback (~4.0s duration)
      const fallbackTimer = window.setTimeout(handleRingFinished, 4050);
      this.phoneRingTimers.push(fallbackTimer);

      if (!this.muted && this.ringingPhoneAudio) {
        try {
          this.ringingPhoneAudio.onended = handleRingFinished;
          this.ringingPhoneAudio.currentTime = 0;
          this.ringingPhoneAudio.volume = 0.85;
          this.ringingPhoneAudio.play().catch(() => {
            // Fallback timer will handle advancing after 4 seconds
          });
        } catch {
          // Fallback timer will handle advancing after 4 seconds
        }
      }
    };

    playSingleRing(1);
  }

  public startClockTickLoop() {
    this.clearClockTickFade();
    if (this.muted || !this.clockTickAudio) return;
    try {
      this.clockTickAudio.currentTime = 0;
      this.clockTickAudio.loop = true;
      this.clockTickAudio.volume = 0.8;
      this.clockTickAudio.play().catch(() => {});
    } catch {
      // Ignore audio errors
    }
  }

  public fadeOutClockTick(durationMs = 650) {
    this.clearClockTickFade();
    if (!this.clockTickAudio) return;
    const audio = this.clockTickAudio;
    if (audio.paused) return;

    const startVol = audio.volume;
    const steps = 16;
    const stepMs = Math.max(20, Math.floor(durationMs / steps));
    let currentStep = 0;

    if (typeof window !== 'undefined') {
      this.clockTickFadeTimer = window.setInterval(() => {
        currentStep += 1;
        const nextVol = Math.max(0, startVol * (1 - currentStep / steps));
        audio.volume = nextVol;
        if (currentStep >= steps || nextVol <= 0.01) {
          this.clearClockTickFade();
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.8;
        }
      }, stepMs);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  public playWinSound6AM() {
    if (this.muted || !this.winSoundAudio) return;
    try {
      this.winSoundAudio.currentTime = 0;
      this.winSoundAudio.volume = 0.95;
      this.winSoundAudio.play().catch(() => {});
    } catch {
      // Fallback chime if audio element blocked
      this.play6AMChime();
    }
  }

  public stopAll(includeBackgroundLoops = false) {
    this.clearClockTickFade();
    this.clearFreddyLaughTimers();
    this.stopPhoneRingSequence();
    [
      this.jumpscareAudio,
      this.nightmareJumpscareAudio,
      this.footstepsAudio,
      this.nightmareFootstepsAudio,
      this.ventAudio,
      this.freddyLaughAudio,
      this.winSoundAudio,
      this.clockTickAudio,
      this.ringingPhoneAudio,
    ].forEach((a) => {
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    });
    if (includeBackgroundLoops) {
      [this.creepyAmbienceAudio, this.menuMusicAudio].forEach((a) => {
        if (a) {
          a.pause();
        }
      });
    }
  }

  public playFootsteps(volume = 0.75) {
    if (this.muted || !this.footstepsAudio) return;
    try {
      const clone = this.footstepsAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0.1, Math.min(1, volume));
      clone.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playNightmareFootsteps(volume = 0.88) {
    if (this.muted || !this.nightmareFootstepsAudio) return;
    try {
      const clone = this.nightmareFootstepsAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0.1, Math.min(1, volume));
      clone.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playVentCrawl(volume = 0.85) {
    if (this.muted || !this.ventAudio) return;
    try {
      const clone = this.ventAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0.1, Math.min(1, volume));
      clone.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playFreddyLaugh(volume = 0.92) {
    if (this.muted || !this.freddyLaughAudio) return;
    try {
      const clone = this.freddyLaughAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0.1, Math.min(1, volume));
      clone.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  /**
   * Plays the ventilation footsteps sound immediately ("golpe a la ventilación reproduciendo
   * el sonido de pasos en la ventilación") and 1 second later plays "Risa-Freddy".
   */
  public playFreddyVentFakeout() {
    if (this.muted) return;
    this.playVentCrawl(0.9);
    if (typeof window !== 'undefined') {
      const timerId = window.setTimeout(() => {
        this.freddyLaughTimers = this.freddyLaughTimers.filter((id) => id !== timerId);
        this.playFreddyLaugh(0.92);
      }, FREDDY_VENT_LAUGH_DELAY_MS);
      this.freddyLaughTimers.push(timerId);
    }
  }

  public playJumpscare() {
    if (this.muted || !this.jumpscareAudio) return;
    try {
      this.jumpscareAudio.currentTime = 0;
      this.jumpscareAudio.volume = 1.0;
      this.jumpscareAudio.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playNightmareJumpscare() {
    if (this.muted || !this.nightmareJumpscareAudio) return;
    try {
      this.nightmareJumpscareAudio.currentTime = 0;
      this.nightmareJumpscareAudio.volume = 1.0;
      this.nightmareJumpscareAudio.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playWoodHover() {
    if (this.muted || !this.woodHoverAudio) return;
    try {
      const clone = this.woodHoverAudio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.78;
      clone.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playWoodClick() {
    if (this.muted || !this.woodClickAudio) return;
    try {
      const clone = this.woodClickAudio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.92;
      clone.play().catch(() => {});
    } catch {
      // Fallback
    }
  }

  public playDoorSlam(closed: boolean) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(closed ? 140 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(closed ? 38 : 165, now + 0.22);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playCameraBlip() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.setValueAtTime(1560, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playElectricalFlicker() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Electrical buzz for 1.5s when animatronic leaves the vent
    for (let i = 0; i < 6; i++) {
      const start = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60 + (i % 2) * 55, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  public playDoorKnock() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(92, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.12);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    }
  }

  public playPhaseShift3AM() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 1.1);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  public playHeavyGlitchTransition() {
    // Removed synthesized mechanical WebAudio noise when starting/restarting/continuing nights
  }

  public play6AMChime() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.35);
      gain.gain.setValueAtTime(0.18, now + idx * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.35 + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.35);
      osc.stop(now + idx * 0.35 + 1.25);
    });
  }

  public dispatchEvents(events: GameAudioEvent[]) {
    for (const ev of events) {
      switch (ev) {
        case 'FOOTSTEPS':
          this.playFootsteps();
          break;
        case 'NIGHTMARE_FOOTSTEPS':
          this.playNightmareFootsteps();
          break;
        case 'VENT_CRAWL':
          this.playVentCrawl();
          break;
        case 'FREDDY_VENT_FAKEOUT':
          this.playFreddyVentFakeout();
          break;
        case 'VENT_RETREAT_FLICKER':
          this.playElectricalFlicker();
          break;
        case 'DOOR_KNOCK':
          this.playDoorKnock();
          break;
        case 'PHASE_SHIFT_3AM':
          this.playPhaseShift3AM();
          break;
        case 'JUMPSCARE':
          this.playJumpscare();
          break;
        case 'NIGHTMARE_JUMPSCARE':
          this.playNightmareJumpscare();
          break;
      }
    }
  }
}

export const soundController = new SoundController();
