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
  thunderStrike: './assets/aistudio/thunder-sound-effect_5b2ec72b.mp3',
  glassBreak: './assets/aistudio/glass-break-sfx_65fa8558.mp3',
  rainLoop: './assets/aistudio/donrain-rain-110508_532a9e68.mp3',
  keyGet: './assets/aistudio/freesound_community-key-get-39925_7af63c80.mp3',
  heavyLockUnlock: './assets/aistudio/heavy-door-lock-unlocking-1-www_9700144c.mp3',
  floorboardCreak: './assets/aistudio/dragon-studio-floorboard-creak-03-499651_61ae26e3.mp3',
  bathroomFan: './assets/aistudio/kodiakid-bathroom-fan-271527_5be1f59a.mp3',
  darkRabbitJumpscare: './assets/aistudio/Jumpscare_dark_rabbit_final_c46aea63.mp3',
  theThingLaughFinal1: './assets/aistudio/Risa_the_thing-Final1_27e963d0.mp3',
} as const;

type AudioKey = keyof typeof AUDIO_PATHS;

class SoundController {
  private ctx: AudioContext | null = null;
  private muted = false;
  private audioElements: Partial<Record<AudioKey, HTMLAudioElement>> = {};
  private blobUrlPromises: Partial<Record<AudioKey, Promise<string>>> = {};
  private resolvedBlobUrls: Partial<Record<AudioKey, string>> = {};
  private clockTickFadeTimer: number | null = null;
  private freddyLaughTimers: number[] = [];
  private phoneRingTimers: number[] = [];
  private menuAudioActive = true;
  private rainLoopActive = false;
  private officeFanActive = false;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as unknown as { __soundController?: SoundController }).__soundController = this;
    }
  }

  /**
   * Fetches an audio asset at most ONCE via a single 200 OK request and caches it as an
   * in-memory blob: URL. This completely prevents 16x preload="auto" startup storms and
   * repeated 206 Partial Content HTTP Range requests that cause "Rate exceeded." on proxies.
   */
  private getBlobUrl(key: AudioKey): Promise<string> {
    if (this.resolvedBlobUrls[key]) {
      return Promise.resolve(this.resolvedBlobUrls[key]!);
    }
    if (!this.blobUrlPromises[key]) {
      const path = AUDIO_PATHS[key];
      this.blobUrlPromises[key] = fetch(path, { cache: 'force-cache' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          this.resolvedBlobUrls[key] = url;
          return url;
        })
        .catch(() => {
          // Fallback to direct path if fetch fails
          this.resolvedBlobUrls[key] = path;
          return path;
        });
    }
    return this.blobUrlPromises[key]!;
  }

  /**
   * Lazily gets or creates the single HTMLAudioElement for a given key without preloading
   * on initial page startup.
   */
  private getOrCreateAudio(
    key: AudioKey,
    defaultVolume = 0.85,
    loop = false
  ): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    let el = this.audioElements[key];
    if (!el) {
      el = new Audio();
      el.preload = 'none';
      el.volume = defaultVolume;
      el.loop = loop;
      this.audioElements[key] = el;
    }
    return el;
  }

  /**
   * Plays an audio asset using its cached in-memory blob: URL so the browser never issues
   * repeated HTTP Range requests on loop or replay.
   */
  private playCachedAudio(
    key: AudioKey,
    options: {
      volume?: number;
      loop?: boolean;
      resetTime?: boolean;
      guard?: () => boolean;
      onEnded?: (() => void) | null;
    } = {}
  ) {
    if (this.muted || typeof window === 'undefined') return;
    const el = this.getOrCreateAudio(key, options.volume ?? 0.85, options.loop ?? false);
    if (!el) return;

    this.getBlobUrl(key)
      .then((blobUrl) => {
        if (this.muted || (options.guard && !options.guard())) {
          el.pause();
          return;
        }
        if (el.src !== blobUrl) {
          el.src = blobUrl;
        }
        el.loop = Boolean(options.loop);
        if (typeof options.volume === 'number') {
          el.volume = Math.max(0, Math.min(1, options.volume));
        }
        if (options.onEnded !== undefined) {
          el.onended = options.onEnded;
        }
        if (options.resetTime !== false) {
          try {
            el.currentTime = 0;
          } catch {
            // Ignore if metadata not yet loaded
          }
        }
        el.play()
          .then(() => {
            if (this.muted || (options.guard && !options.guard())) {
              el.pause();
              el.currentTime = 0;
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }

  private get creepyAmbienceAudio(): HTMLAudioElement | null {
    return this.audioElements.creepyAmbience ?? null;
  }
  private get menuMusicAudio(): HTMLAudioElement | null {
    return this.audioElements.menuMusic ?? null;
  }
  private get winSoundAudio(): HTMLAudioElement | null {
    return this.audioElements.winSound ?? null;
  }
  private get clockTickAudio(): HTMLAudioElement | null {
    return this.audioElements.clockTick ?? null;
  }
  private get ringingPhoneAudio(): HTMLAudioElement | null {
    return this.audioElements.ringingPhone ?? null;
  }
  private get rainAudio(): HTMLAudioElement | null {
    return this.audioElements.rainLoop ?? null;
  }
  private get bathroomFanAudio(): HTMLAudioElement | null {
    return this.audioElements.bathroomFan ?? null;
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

    const ambience = this.getOrCreateAudio('creepyAmbience', 0.42, true);
    if (ambience && ambience.paused) {
      this.playCachedAudio('creepyAmbience', {
        volume: 0.42,
        loop: true,
        resetTime: false,
        guard: () => this.menuAudioActive && !this.muted,
      });
    }

    const music = this.getOrCreateAudio('menuMusic', 0.17, true);
    if (music && music.paused) {
      this.playCachedAudio('menuMusic', {
        volume: 0.17,
        loop: true,
        resetTime: false,
        guard: () => this.menuAudioActive && !this.muted,
      });
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

  /**
   * Starts or continues the rain audio loop ("donrain-rain").
   * Crucially, if the rain audio is already playing from a previous rain scene,
   * it does NOT reset currentTime or restart playback ("en caso de haber 2 escenas
   * seguidas con lluvia no se reinicie el audio si no haz que este se reproduzca de continuo").
   */
  public startRainLoop() {
    this.rainLoopActive = true;
    if (this.muted) return;
    const rain = this.getOrCreateAudio('rainLoop', 0.52, true);
    if (!rain || !rain.paused) {
      return;
    }
    this.playCachedAudio('rainLoop', {
      volume: 0.52,
      loop: true,
      resetTime: false,
      guard: () => this.rainLoopActive && !this.muted,
    });
  }

  public stopRainLoop() {
    this.rainLoopActive = false;
    if (this.rainAudio) {
      this.rainAudio.pause();
      this.rainAudio.currentTime = 0;
    }
  }

  public getRainAudioStatus() {
    return {
      rainLoopActive: this.rainLoopActive,
      rainPaused: this.rainAudio ? this.rainAudio.paused : true,
      currentTime: this.rainAudio ? this.rainAudio.currentTime : 0,
    };
  }

  /**
   * Starts or continues the office ventilation fan audio loop ("kodiakid-bathroom-fan")
   * whenever the player is (or has been) in the office during a night.
   */
  public startOfficeFanLoop() {
    this.officeFanActive = true;
    if (this.muted) return;
    const fanVol = 0.38 * 1.15; // +15% office fan volume during nights (0.437)
    const fan = this.getOrCreateAudio('bathroomFan', fanVol, true);
    if (!fan) {
      return;
    }
    fan.volume = fanVol;
    if (!fan.paused) {
      return;
    }
    this.playCachedAudio('bathroomFan', {
      volume: fanVol,
      loop: true,
      resetTime: false,
      guard: () => this.officeFanActive && !this.muted,
    });
  }

  public stopOfficeFanLoop() {
    this.officeFanActive = false;
    if (this.bathroomFanAudio) {
      this.bathroomFanAudio.pause();
      this.bathroomFanAudio.currentTime = 0;
    }
  }

  public getOfficeFanAudioStatus() {
    return {
      officeFanActive: this.officeFanActive,
      fanPaused: this.bathroomFanAudio ? this.bathroomFanAudio.paused : true,
      currentTime: this.bathroomFanAudio ? this.bathroomFanAudio.currentTime : 0,
    };
  }

  public playGlassBreak() {
    this.playCachedAudio('glassBreak', { volume: 0.95, resetTime: true });
  }

  public playKeyGet() {
    this.playCachedAudio('keyGet', { volume: 0.92, resetTime: true });
  }

  public playHeavyDoorLockUnlock() {
    this.playCachedAudio('heavyLockUnlock', { volume: 0.95, resetTime: true });
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      this.stopAll(true, true);
    } else {
      const isTitle =
        typeof document !== 'undefined' && document.body?.dataset?.state === 'title';
      this.ensureBackgroundLoops(isTitle);
      if (this.rainLoopActive) {
        this.startRainLoop();
      }
      if (this.officeFanActive) {
        this.startOfficeFanLoop();
      }
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

    const phoneRingVol = 0.85 * 0.75; // -25% ringtone volume across the game (0.6375)

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

      if (!this.muted) {
        this.playCachedAudio('ringingPhone', {
          volume: phoneRingVol,
          resetTime: true,
          onEnded: handleRingFinished,
        });
      }
    };

    playSingleRing(1);
  }

  /**
   * Plays the same office ringing phone audio in an infinite loop (with 1s gap between rings)
   * until stopPhoneRingSequence() is called when the player answers the hotel room phone.
   */
  public startInfinitePhoneRing() {
    this.stopPhoneRingSequence();
    if (typeof window === 'undefined') return;

    const phoneRingVol = 0.85 * 0.75; // -25% ringtone volume across the game (0.6375)
    let active = true;
    const playLoopRing = () => {
      if (!active) return;

      let handledEnd = false;
      const handleRingFinished = () => {
        if (handledEnd || !active) return;
        handledEnd = true;
        if (this.ringingPhoneAudio) {
          this.ringingPhoneAudio.onended = null;
        }
        const gapTimer = window.setTimeout(() => {
          playLoopRing();
        }, PHONE_RING_GAP_MS);
        this.phoneRingTimers.push(gapTimer);
      };

      const fallbackTimer = window.setTimeout(handleRingFinished, 4050);
      this.phoneRingTimers.push(fallbackTimer);

      if (!this.muted) {
        this.playCachedAudio('ringingPhone', {
          volume: phoneRingVol,
          resetTime: true,
          onEnded: handleRingFinished,
          guard: () => active && !this.muted,
        });
      }
    };

    playLoopRing();
  }

  public playThunderStrike() {
    this.playCachedAudio('thunderStrike', { volume: 0.95, resetTime: true });
  }

  public startClockTickLoop() {
    this.clearClockTickFade();
    this.playCachedAudio('clockTick', {
      volume: 0.8,
      loop: true,
      resetTime: true,
    });
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
    if (this.muted) return;
    this.playCachedAudio('winSound', { volume: 0.95, resetTime: true });
  }

  public isWinSoundPlaying(): boolean {
    if (!this.winSoundAudio || this.muted) return false;
    return !this.winSoundAudio.paused && !this.winSoundAudio.ended;
  }

  public stopAll(includeBackgroundLoops = false, stopWinSound = false) {
    this.clearClockTickFade();
    this.clearFreddyLaughTimers();
    this.stopPhoneRingSequence();
    this.stopRainLoop();
    const keysToStop: AudioKey[] = [
      'jumpscare',
      'nightmareJumpscare',
      'darkRabbitJumpscare',
      'theThingLaughFinal1',
      'footsteps',
      'nightmareFootsteps',
      'vent',
      'freddyLaugh',
      'clockTick',
      'ringingPhone',
      'thunderStrike',
      'glassBreak',
      'floorboardCreak',
    ];
    if (stopWinSound) {
      keysToStop.push('winSound');
    }
    keysToStop.forEach((k) => {
      const a = this.audioElements[k];
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    });
    if (includeBackgroundLoops) {
      [this.creepyAmbienceAudio, this.menuMusicAudio, this.bathroomFanAudio].forEach((a) => {
        if (a) {
          a.pause();
        }
      });
    }
  }

  public playFootsteps(volume = 0.75) {
    this.playCachedAudio('footsteps', {
      volume: Math.max(0.1, Math.min(1, volume)),
      resetTime: true,
    });
  }

  public playNightmareFootsteps(volume = 0.88) {
    this.playCachedAudio('nightmareFootsteps', {
      volume: Math.max(0.1, Math.min(1, volume)),
      resetTime: true,
    });
  }

  public playVentCrawl(volume = 0.85) {
    this.playCachedAudio('vent', {
      volume: Math.max(0.1, Math.min(1, volume)),
      resetTime: true,
    });
  }

  public playFreddyLaugh(volume = 0.92) {
    this.playCachedAudio('freddyLaugh', {
      volume: Math.max(0.1, Math.min(1, volume)),
      resetTime: true,
    });
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
    this.playCachedAudio('jumpscare', { volume: 1.0, resetTime: true });
  }

  public playNightmareJumpscare() {
    this.playCachedAudio('nightmareJumpscare', { volume: 1.0, resetTime: true });
  }

  public playDarkRabbitJumpscare() {
    this.playCachedAudio('darkRabbitJumpscare', { volume: 1.0, resetTime: true });
  }

  public playTheThingLaughFinal1(onEnded?: () => void) {
    if (this.muted) {
      if (onEnded && typeof window !== 'undefined') {
        window.setTimeout(onEnded, 2050);
      } else {
        onEnded?.();
      }
      return;
    }
    this.playCachedAudio('theThingLaughFinal1', {
      volume: 1.0,
      resetTime: true,
      onEnded,
    });
  }

  public stopTheThingLaughFinal1() {
    const a = this.audioElements.theThingLaughFinal1;
    if (a) {
      a.onended = null;
      a.pause();
      a.currentTime = 0;
    }
  }

  public isJumpscarePlaying(): boolean {
    const a = this.audioElements.jumpscare;
    if (!a || this.muted) return false;
    return !a.paused && !a.ended;
  }

  public isNightmareJumpscarePlaying(): boolean {
    const a = this.audioElements.nightmareJumpscare;
    if (!a || this.muted) return false;
    return !a.paused && !a.ended;
  }

  public playWoodHover() {
    this.playCachedAudio('woodHover', { volume: 0.78, resetTime: true });
  }

  public playWoodClick() {
    this.playCachedAudio('woodClick', { volume: 0.92, resetTime: true });
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

  /**
   * Plays the attached "Dragon-studio-floorboard-creak" audio effect when reaching the corridor door.
   */
  public playCreakSound() {
    if (this.muted) return;
    this.playCachedAudio('floorboardCreak', { volume: 0.95, resetTime: true });
  }

  /**
   * Metallic doorknob/key rattle when pressing [E] on a locked hotel room door (instead of animatronic footsteps/knock).
   */
  public playLockedDoorRattle() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clicks = [0, 0.09];
    for (let i = 0; i < clicks.length; i++) {
      const t = now + clicks[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 520 : 410, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.055);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.065);
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
