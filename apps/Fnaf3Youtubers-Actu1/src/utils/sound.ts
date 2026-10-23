import { useRef, useCallback, useEffect, useMemo } from 'react';
import { CharacterId } from '../data/fnafMapData';
import { FREDDY_NOSE_MP3_BASE64, FREDDY_NOSE_MP3_DATA_URI } from './freddyNoseMp3';
import { FNAF3_START_MP3_BASE64, FNAF3_START_MP3_DATA_URI } from './fnaf3StartMp3';

const FREDDY_NOSE_ARRAY_BUFFER: ArrayBuffer = (() => {
  const binaryString = window.atob(FREDDY_NOSE_MP3_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})();

const FNAF3_START_ARRAY_BUFFER: ArrayBuffer = (() => {
  const binaryString = window.atob(FNAF3_START_MP3_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})();

export const NIGHT_PHONE_CALLS: Record<
  number,
  { title: string; caller: string; lines: string[] }
> = {
  1: {
    title: 'NOCHE 1 — BIENVENIDA A LA OFICINA TRIBUTARIA DE LOS PIRINEOS',
    caller: 'SUBDIRECTOR GENERAL DE INSPECCIÓN (HACIENDA)',
    lines: [
      '«¿Hola? ¿Hola, me escuchas? ¡Bienvenido a tu primer turno nocturno como Inspector de Hacienda en la frontera de Andorra!»',
      '«Esta primera noche es totalmente tranquila: todavía no ha llegado ningún gran streamer al búnker, así que aprovecha para familiarizarte con el equipo.»',
      '«A tu derecha tienes el Monitor de Cámaras: las cámaras 01 a 10 vigilan los pasillos y las cámaras 11 a 15 vigilan los conductos de ventilación. Si haces doble clic en una cámara de conducto, sellarás la compuerta.»',
      '«A tu izquierda tienes el Panel de Mantenimiento naranja. Estos sistemas son de los años 80 y fallan mucho: si se apaga la ventilación empezarás a tener alucinaciones, así que reinícialo rápido. ¡Pasa buena noche, mañana empieza lo fuerte!»',
    ],
  },
  2: {
    title: 'NOCHE 2 — ALERTA ROJA: HAN ENCONTRADO A AURONPLAY',
    caller: 'SUBDIRECTOR GENERAL DE INSPECCIÓN (HACIENDA)',
    lines: [
      '«¡Inspector, menos mal que contestas! Acabamos de encontrar uno de verdad en la Cámara 09 del búnker norte... ¡es AuronPlay dentro del traje de Springtrap!»',
      '«Va a intentar colarse en tu oficina por la puerta izquierda o por los conductos de ventilación para embargarte a ti. Usa el botón PLAY AUDIO ("¡Abduzcan!") en una cámara cercana para atraerlo lejos de tu despacho.»',
      '«Y ten mucho cuidado con las cámaras: hoy también se han activado las alucinaciones de Chiqui-Ibai, Cristinini colgada en la CAM 04, KNekro en el pasillo de la CAM 08 y la cara de AriGameplays con los 3,99 dólares en la máquina arcade de la CAM 07. Si los ves, ¡cambia de cámara al instante!»',
    ],
  },
  3: {
    title: 'NOCHE 3 — ALERTA DE CHEPA GAMER Y LADRIDOS EN LA OFICINA',
    caller: 'SUBDIRECTOR GENERAL DE INSPECCIÓN (HACIENDA)',
    lines: [
      '«¡Oye, sigues vivo en la Noche 3! Pero la cosa se complica: hemos detectado al Rubius Chepudo caminando encorvado frente al cristal de tu oficina.»',
      '«Si ves al Rubius Chepudo cruzando la ventana, NO te quedes mirándolo: sube el monitor de cámaras o abre el panel de mantenimiento hasta que pase de largo, o te pegará un susto de muerte.»',
      '«También ten cuidado al bajar el monitor de cámaras: IShowSpeed suele aparecer agazapado junto a la caja de embargos a tu izquierda. Si lo ves al bajar la cámara, vuelve a subirla rápido antes de girar la vista.»',
    ],
  },
  4: {
    title: 'NOCHE 4 — EVASIÓN FISCAL MASIVA EN LOS CONDUCTOS',
    caller: 'SUBDIRECTOR GENERAL DE INSPECCIÓN (HACIENDA)',
    lines: [
      '«¡Inspector, aguanta! En la Noche 4 AuronPlay se mueve mucho más rápido por los conductos CAM 14 y CAM 15 que dan directo a tu silla.»',
      '«Recuerda que el dispositivo de Audio solo tiene unos pocos usos antes de dar error. No dejes de vigilar la máquina de 3,99 dólares en la CAM 07 ni los cables de Cristinini en la CAM 04.»',
    ],
  },
  5: {
    title: 'NOCHE 5 — AUDITORÍA FINAL ANTES DEL CIERRE CONTABLE',
    caller: 'SUBDIRECTOR GENERAL DE INSPECCIÓN (HACIENDA)',
    lines: [
      '«¡Última noche oficial, Inspector! Todos los youtubers andorranos están al máximo de agresividad para evitar el Modelo 720.»',
      '«Mantén un conducto estratégico siempre sellado, usa el señuelo de voz con cabeza y sobrevive hasta las 6 de la mañana para cobrar tu cheque de la Agencia Tributaria. ¡Mucha suerte!»',
    ],
  },
};

export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);
  const phoneRingTimerRef = useRef<number | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // Camera switch static blip
  const playCamBlip = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(980, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // Play Audio Lure ("¡Abduzcan!")
  const playAudioLureSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 587.33, 493.88];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.14, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.005, now + (idx + 1) * 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + (idx + 1) * 0.11);
      });
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // Vent seal metallic clank
  const playVentSealSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // Distinct Character Jumpscare Screeches (100% reliable + voice synthesis shout)
  const playCharacterJumpscareSound = useCallback(
    (character: CharacterId) => {
      try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        const duration = character === 'AURONPLAY' ? 1.55 : 1.15;

        // 1. White/Pink Noise Burst for FNAF 3 static shriek
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (duration * 0.7)));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        const baseFreq =
          character === 'AURONPLAY'
            ? 950
            : character === 'ISHOWSPEED'
            ? 1650
            : character === 'ARIGAMEPLAYS'
            ? 1850
            : character === 'CHIQUI_IBAI'
            ? 1400
            : 1150;
        filter.frequency.setValueAtTime(baseFreq, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.42, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        // 2. Dual Dissonant Screech Oscillators
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';

        if (character === 'AURONPLAY') {
          osc1.frequency.setValueAtTime(240, now);
          osc1.frequency.linearRampToValueAtTime(720, now + 0.3);
          osc1.frequency.linearRampToValueAtTime(190, now + duration);
          osc2.frequency.setValueAtTime(530, now);
          osc2.frequency.linearRampToValueAtTime(210, now + 0.6);
          osc2.frequency.linearRampToValueAtTime(790, now + duration);
        } else if (character === 'ISHOWSPEED') {
          // Rapid barking frequency spikes
          osc1.frequency.setValueAtTime(620, now);
          osc1.frequency.setValueAtTime(980, now + 0.18);
          osc1.frequency.setValueAtTime(420, now + 0.35);
          osc1.frequency.setValueAtTime(1080, now + 0.55);
          osc2.frequency.setValueAtTime(450, now);
          osc2.frequency.linearRampToValueAtTime(880, now + duration);
        } else if (character === 'ARIGAMEPLAYS') {
          // Arcade coin chime + high phantom shriek
          osc1.frequency.setValueAtTime(987.77, now);
          osc1.frequency.setValueAtTime(1318.51, now + 0.12);
          osc1.frequency.linearRampToValueAtTime(640, now + duration);
          osc2.frequency.setValueAtTime(740, now);
          osc2.frequency.linearRampToValueAtTime(310, now + duration);
        } else {
          osc1.frequency.setValueAtTime(760, now);
          osc1.frequency.linearRampToValueAtTime(280, now + 0.45);
          osc1.frequency.linearRampToValueAtTime(910, now + duration);
          osc2.frequency.setValueAtTime(390, now);
          osc2.frequency.linearRampToValueAtTime(670, now + duration);
        }

        oscGain.gain.setValueAtTime(0.32, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        osc1.connect(oscGain);
        osc2.connect(oscGain);
        oscGain.connect(ctx.destination);

        noise.start(now);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
      } catch {
        // Ignore
      }
    },
    [getCtx]
  );

  // Cristinini / Phantom Mangle garbled radio noise
  const playCristininiRadioBurst = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      for (let i = 0; i < 10; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(260 + Math.random() * 1550, now + i * 0.12);
        gain.gain.setValueAtTime(0.14, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.005, now + (i + 1) * 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + (i + 1) * 0.12);
      }
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // KNekro / Phantom Puppet eerie distorted music box & static drone when blocking face in office
  const playKNekroPuppetSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      // Eerie detuned music box notes ("Grandfather's Clock" / Puppet theme) + low warble
      const melody = [523.25, 493.88, 440, 392, 440, 349.23, 329.63, 293.66];
      melody.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        sub.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.25);
        sub.frequency.setValueAtTime(freq * 0.5, now + idx * 0.25);
        gain.gain.setValueAtTime(0.15, now + idx * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.008, now + (idx + 1) * 0.25);
        osc.connect(gain);
        sub.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.25);
        sub.start(now + idx * 0.25);
        osc.stop(now + (idx + 1) * 0.25);
        sub.stop(now + (idx + 1) * 0.25);
      });
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // Classic FNAF Telephone Ring + Synthesized Voice Call
  const startPhoneGuyCall = useCallback(
    (nightNum: number, muted: boolean) => {
      if (muted) return;
      try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        // Two classic phone rings (440Hz + 480Hz dual tone)
        [0, 1.2].forEach((offset) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, now + offset);
          osc2.frequency.setValueAtTime(480, now + offset);
          gain.gain.setValueAtTime(0.08, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.002, now + offset + 0.65);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now + offset);
          osc2.start(now + offset);
          osc1.stop(now + offset + 0.65);
          osc2.stop(now + offset + 0.65);
        });

        // Start Web Speech API Spanish voice synthesis after phone picks up
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const script = NIGHT_PHONE_CALLS[nightNum] || NIGHT_PHONE_CALLS[1];
          phoneRingTimerRef.current = window.setTimeout(() => {
            const fullText = script.lines.join(' ');
            const utterance = new SpeechSynthesisUtterance(fullText);
            utterance.lang = 'es-ES';
            utterance.rate = 1.04;
            utterance.pitch = 0.88;
            utterance.volume = 0.85;
            window.speechSynthesis.speak(utterance);
          }, 2100);
        }
      } catch {
        // Ignore
      }
    },
    [getCtx]
  );

  const stopPhoneGuyCall = useCallback(() => {
    if (phoneRingTimerRef.current) {
      clearTimeout(phoneRingTimerRef.current);
      phoneRingTimerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Reboot tick sound
  const playRebootTick = useCallback(
    (complete = false) => {
      try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = complete ? 'sine' : 'square';
        osc.frequency.setValueAtTime(complete ? 880 : 320, now);
        if (complete) {
          osc.frequency.setValueAtTime(1174.66, now + 0.09);
        }
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + (complete ? 0.25 : 0.07));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + (complete ? 0.25 : 0.07));
      } catch {
        // Ignore
      }
    },
    [getCtx]
  );

  // 6 AM Chime
  const playVictoryChime = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.35);
        gain.gain.setValueAtTime(0.18, now + idx * 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.35 + 1.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.35);
        osc.stop(now + idx * 0.35 + 1.8);
      });
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // Subtle alarm beep when Ventilation is failing
  const playAlarmBeep = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(480, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }, [getCtx]);

  // Iconic FNAF 1/2/3 Freddy Poster Nose Honk using the user's attached MP3 file!
  const noseBufferRef = useRef<AudioBuffer | null>(null);
  const noseHtmlAudioPoolRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    // Pre-create a pool of preloaded HTMLAudioElements from the in-memory Data URI
    try {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < 4; i++) {
        const a = new Audio(FREDDY_NOSE_MP3_DATA_URI);
        a.preload = 'auto';
        a.volume = 1.0;
        pool.push(a);
      }
      noseHtmlAudioPoolRef.current = pool;
    } catch {
      // Ignore
    }
  }, []);

  const playFreddyNoseHonk = useCallback(() => {
    let playedViaWebAudio = false;
    try {
      const ctx = getCtx();
      const triggerBuffer = (buffer: AudioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.2, ctx.currentTime);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      };

      if (noseBufferRef.current) {
        triggerBuffer(noseBufferRef.current);
        playedViaWebAudio = true;
      } else {
        ctx
          .decodeAudioData(FREDDY_NOSE_ARRAY_BUFFER.slice(0))
          .then((decoded) => {
            noseBufferRef.current = decoded;
            triggerBuffer(decoded);
          })
          .catch(() => {
            // Fallback to HTMLAudioElement pool if decodeAudioData fails
            const fallbackAudio = new Audio(FREDDY_NOSE_MP3_DATA_URI);
            fallbackAudio.volume = 1.0;
            fallbackAudio.play().catch(() => {});
          });
        playedViaWebAudio = true;
      }
    } catch {
      // Ignore WebAudio error and use HTMLAudioElement fallback below
    }

    if (!playedViaWebAudio) {
      try {
        const pool = noseHtmlAudioPoolRef.current;
        const available = pool.find((a) => a.paused || a.ended) || pool[0];
        if (available) {
          available.currentTime = 0;
          available.volume = 1.0;
          available.play().catch(() => {});
        } else {
          const direct = new Audio(FREDDY_NOSE_MP3_DATA_URI);
          direct.volume = 1.0;
          direct.play().catch(() => {});
        }
      } catch {
        // Ignore
      }
    }
  }, [getCtx]);

  // Authentic FNAF 3 Night Start Sound using the user's attached MP3 (`/assets/aistudio/fnaf-3-start-sound_15f70752.mp3`)
  const nightStartBufferRef = useRef<AudioBuffer | null>(null);
  const nightStartHtmlAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const a = new Audio(FNAF3_START_MP3_DATA_URI);
      a.preload = 'auto';
      a.volume = 1.0;
      nightStartHtmlAudioRef.current = a;
    } catch {
      // Ignore
    }
  }, []);

  const playNightStartSound = useCallback(() => {
    let playedViaWebAudio = false;
    try {
      const ctx = getCtx();
      const triggerBuffer = (buffer: AudioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.15, ctx.currentTime);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      };

      if (nightStartBufferRef.current) {
        triggerBuffer(nightStartBufferRef.current);
        playedViaWebAudio = true;
      } else {
        ctx
          .decodeAudioData(FNAF3_START_ARRAY_BUFFER.slice(0))
          .then((decoded) => {
            nightStartBufferRef.current = decoded;
            triggerBuffer(decoded);
          })
          .catch(() => {
            const fallbackAudio = new Audio('./assets/aistudio/fnaf-3-start-sound_15f70752.mp3');
            fallbackAudio.volume = 1.0;
            fallbackAudio.play().catch(() => {});
          });
        playedViaWebAudio = true;
      }
    } catch {
      // Fallback below
    }

    if (!playedViaWebAudio) {
      try {
        if (nightStartHtmlAudioRef.current) {
          nightStartHtmlAudioRef.current.currentTime = 0;
          nightStartHtmlAudioRef.current.volume = 1.0;
          nightStartHtmlAudioRef.current.play().catch(() => {});
        } else {
          const direct = new Audio(FNAF3_START_MP3_DATA_URI);
          direct.volume = 1.0;
          direct.play().catch(() => {});
        }
      } catch {
        // Ignore
      }
    }
  }, [getCtx]);

  // Desk Bobblehead spring boing / paper rustle sound for office Easter Eggs
  const playBobbleBoing = useCallback(
    (pitchMultiplier = 1) => {
      try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280 * pitchMultiplier, now);
        osc.frequency.exponentialRampToValueAtTime(520 * pitchMultiplier, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(220 * pitchMultiplier, now + 0.18);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        // Ignore
      }
    },
    [getCtx]
  );

  return useMemo(
    () => ({
      playCamBlip,
      playAudioLureSound,
      playVentSealSound,
      playCharacterJumpscareSound,
      playCristininiRadioBurst,
      playKNekroPuppetSound,
      startPhoneGuyCall,
      stopPhoneGuyCall,
      playRebootTick,
      playVictoryChime,
      playAlarmBeep,
      playFreddyNoseHonk,
      playNightStartSound,
      playBobbleBoing,
    }),
    [
      playCamBlip,
      playAudioLureSound,
      playVentSealSound,
      playCharacterJumpscareSound,
      playCristininiRadioBurst,
      playKNekroPuppetSound,
      startPhoneGuyCall,
      stopPhoneGuyCall,
      playRebootTick,
      playVictoryChime,
      playAlarmBeep,
      playFreddyNoseHonk,
      playNightStartSound,
      playBobbleBoing,
    ]
  );
}

