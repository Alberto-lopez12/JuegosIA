export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraId =
  | 'CAM_1A'
  | 'CAM_1B'
  | 'CAM_1C'
  | 'CAM_2A'
  | 'CAM_2B'
  | 'CAM_3'
  | 'CAM_4A'
  | 'CAM_4B'
  | 'CAM_5'
  | 'CAM_6'
  | 'CAM_7';

export type AnimatronicLocation =
  | CameraId
  | 'LEFT_DOOR'
  | 'RIGHT_DOOR'
  | 'OFFICE_INSIDE';

export type AnimatronicId = 'pedro' | 'rajoy' | 'montero' | 'abascal' | 'echenique';

export interface AnimatronicAILevels {
  pedro: number;   // Freddy Fazbear equivalent (0 - 20)
  rajoy: number;   // Bonnie equivalent (0 - 20)
  montero: number; // Chica equivalent (0 - 20)
  abascal: number; // Foxy equivalent (0 - 20)
}

export interface CameraMetadata {
  id: CameraId;
  shortCode: string;
  name: string;
  fnafEquivalent: string;
  wing: 'center' | 'west' | 'east';
  audioOnly?: boolean;
  mapX: number; // Percentage 0-100 on mini-map
  mapY: number; // Percentage 0-100 on mini-map
  keyHint: string;
}

export const CAMERAS: CameraMetadata[] = [
  {
    id: 'CAM_1A',
    shortCode: '1A',
    name: 'Tribuna de Honor',
    fnafEquivalent: 'Show Stage',
    wing: 'center',
    mapX: 44,
    mapY: 10,
    keyHint: '1',
  },
  {
    id: 'CAM_1B',
    shortCode: '1B',
    name: 'Salón de Columnas',
    fnafEquivalent: 'Dining Area',
    wing: 'center',
    mapX: 42,
    mapY: 28,
    keyHint: '2',
  },
  {
    id: 'CAM_1C',
    shortCode: '1C',
    name: 'Cala del Corsario',
    fnafEquivalent: 'Pirate Cove',
    wing: 'west',
    mapX: 22,
    mapY: 38,
    keyHint: '3',
  },
  {
    id: 'CAM_5',
    shortCode: '5',
    name: 'Sala de Prensa y Taller',
    fnafEquivalent: 'Backstage',
    wing: 'west',
    mapX: 14,
    mapY: 22,
    keyHint: '4',
  },
  {
    id: 'CAM_7',
    shortCode: '7',
    name: 'Aseos Ministeriales',
    fnafEquivalent: 'Restrooms',
    wing: 'east',
    mapX: 78,
    mapY: 25,
    keyHint: '5',
  },
  {
    id: 'CAM_3',
    shortCode: '3',
    name: 'Archivo del B.O.E.',
    fnafEquivalent: 'Supply Closet',
    wing: 'west',
    mapX: 18,
    mapY: 60,
    keyHint: '6',
  },
  {
    id: 'CAM_6',
    shortCode: '6',
    name: 'Cocina Oficial',
    fnafEquivalent: 'Kitchen (Audio Only)',
    wing: 'east',
    audioOnly: true,
    mapX: 82,
    mapY: 56,
    keyHint: '7',
  },
  {
    id: 'CAM_2A',
    shortCode: '2A',
    name: 'Pasillo Oeste A',
    fnafEquivalent: 'West Hall',
    wing: 'west',
    mapX: 34,
    mapY: 64,
    keyHint: '8',
  },
  {
    id: 'CAM_2B',
    shortCode: '2B',
    name: 'Esquina Oeste B',
    fnafEquivalent: 'West Hall Corner',
    wing: 'west',
    mapX: 34,
    mapY: 80,
    keyHint: '9',
  },
  {
    id: 'CAM_4A',
    shortCode: '4A',
    name: 'Pasillo Este A',
    fnafEquivalent: 'East Hall',
    wing: 'east',
    mapX: 58,
    mapY: 64,
    keyHint: '0',
  },
  {
    id: 'CAM_4B',
    shortCode: '4B',
    name: 'Esquina Este B',
    fnafEquivalent: 'East Hall Corner',
    wing: 'east',
    mapX: 58,
    mapY: 80,
    keyHint: '-',
  },
];

export interface AnimatronicFaceCrop {
  src: string;
  /** Normalized crop box (0..1) of the face within the source image */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  /** Normalized split line (0..1) within the face box where the lower jaw separates */
  jawSplitRatio: number;
  /** Eye positions in local head coordinates [-44..44, -78..14] */
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  /** CSS object-position for thumbnail mugshots */
  objectPosition: string;
}

export const ANIMATRONIC_FACE_CROPS: Record<AnimatronicId, AnimatronicFaceCrop> = {
  pedro: {
    src: './assets/aistudio/image_9ccead08.png',
    fx: 0.11,
    fy: 0.0,
    fw: 0.76,
    fh: 1.0,
    jawSplitRatio: 0.76,
    leftEye: { x: -19, y: -52 },
    rightEye: { x: 16, y: -52 },
    objectPosition: '50% 42%',
  },
  rajoy: {
    src: './assets/aistudio/image_ef2723c2.png',
    fx: 0.24,
    fy: 0.0,
    fw: 0.60,
    fh: 0.96,
    jawSplitRatio: 0.68,
    leftEye: { x: -10, y: -48 },
    rightEye: { x: 18, y: -48 },
    objectPosition: '54% 38%',
  },
  montero: {
    src: './assets/aistudio/image_716b4c50.png',
    fx: 0.35,
    fy: 0.10,
    fw: 0.30,
    fh: 0.58,
    jawSplitRatio: 0.74,
    leftEye: { x: -16, y: -44 },
    rightEye: { x: 16, y: -44 },
    objectPosition: '50% 30%',
  },
  abascal: {
    src: './assets/aistudio/image_67abad10.png',
    fx: 0.37,
    fy: 0.14,
    fw: 0.30,
    fh: 0.44,
    jawSplitRatio: 0.75,
    leftEye: { x: -5, y: -42 },
    rightEye: { x: 22, y: -42 },
    objectPosition: '52% 30%',
  },
  echenique: {
    src: './assets/aistudio/image_6fafc05d.png',
    fx: 0.16,
    fy: 0.02,
    fw: 0.66,
    fh: 0.96,
    jawSplitRatio: 0.68,
    leftEye: { x: -16, y: -44 },
    rightEye: { x: 16, y: -44 },
    objectPosition: '50% 42%',
  },
};

export interface AnimatronicDossier {
  id: AnimatronicId;
  name: string;
  alias: string;
  fnafCounterpart: string;
  portraitUrl: string;
  wing: string;
  accentColor: string;
  signatureItem: string;
  behaviorSummary: string;
  counterplayTip: string;
}

export const ANIMATRONIC_DOSSIERS: AnimatronicDossier[] = [
  {
    id: 'pedro',
    name: 'Pedro-Freddy',
    alias: 'El Presidente Titular',
    fnafCounterpart: 'Freddy Fazbear',
    portraitUrl: './assets/aistudio/image_9ccead08.png',
    wing: 'Ala Este (CAM 1A → 1B → 7 → 6 → 4A → 4B)',
    accentColor: '#dc2626',
    signatureItem: 'Chistera Presidencial y Micrófono de Rueda de Prensa',
    behaviorSummary:
      'Se oculta en las sombras y solo avanza cuando no lo vigilas por el monitor. Cada avance emite una risa grave en estéreo. Si se agota la batería al 0%, aparece en la puerta izquierda tocando su caja de música.',
    counterplayTip:
      'Vigílalo frecuentemente en CAM 4B para congelar su avance y cierra la Puerta Derecha [D] antes de abrir el monitor si está en la esquina 4B.',
  },
  {
    id: 'rajoy',
    name: 'Rajoy-Bonnie',
    alias: 'El Guitarrista de Pontevedra',
    fnafCounterpart: 'Bonnie the Bunny',
    portraitUrl: './assets/aistudio/image_ef2723c2.png',
    wing: 'Ala Oeste (CAM 1A → 1B → 5 → 3 → 2A → 2B → Puerta Izq.)',
    accentColor: '#3b82f6',
    signatureItem: 'Gafas Metálicas, Pajarita Roja y Guitarra Eléctrica B.O.E.',
    behaviorSummary:
      'Es el primero en abandonar la Tribuna de Honor y puede saltar cámaras en el Ala Oeste. Se coloca en el punto ciego de la Puerta Izquierda; solo lo verás al encender la Luz Izquierda [Q].',
    counterplayTip:
      'Comprueba la Luz Izquierda [Q] con frecuencia. Si ves su silueta junto a la puerta, cierra inmediatamente la Puerta Izquierda [A] hasta que se marche. Si entra mientras miras el monitor, bloqueará los botones.',
  },
  {
    id: 'montero',
    name: 'Montero-Chica',
    alias: 'La Portavoz con Cupcake',
    fnafCounterpart: 'Chica the Chicken',
    portraitUrl: './assets/aistudio/image_716b4c50.png',
    wing: 'Ala Este (CAM 1A → 1B → 7 → 6 → 4A → 4B → Puerta Der.)',
    accentColor: '#a855f7',
    signatureItem: 'Babero "¡A Legislar!" y Mr. Cupcake con Megáfono',
    behaviorSummary:
      'Avanza metódicamente por el Ala Este. Cuando entra en la Cocina Oficial (CAM 6, solo audio), se escuchan cacerolas metálicas. Acecha tras el cristal de la ventana derecha.',
    counterplayTip:
      'Enciende la Luz Derecha [E] para revisar la ventana. Si está pegada al cristal con Mr. Cupcake, cierra la Puerta Derecha [D] y espera a que retroceda al Pasillo Este.',
  },
  {
    id: 'abascal',
    name: 'Abascal-Foxy',
    alias: 'El Corsario de la Cala 1C',
    fnafCounterpart: 'Foxy the Pirate Fox',
    portraitUrl: './assets/aistudio/image_67abad10.png',
    wing: 'Cala 1C → Sprint por Pasillo Oeste (CAM 2A) → Puerta Izq.',
    accentColor: '#16a34a',
    signatureItem: 'Parche Pirata, Casaca Verde y Garfio de Acero',
    behaviorSummary:
      'Permanece oculto tras la cortina "FUERA DE SERVICIO" en CAM 1C en 4 fases (Cerrada → Asomando → Fuera → ¡Ha salido!). Si descuidas el monitor CCTV demasiado tiempo, sale corriendo a toda velocidad por el Pasillo Oeste (CAM 2A).',
    counterplayTip:
      'Abre el monitor regularmente para frenar su contador. Si ves CAM 1C vacía, cierra la Puerta Izquierda [A] ANTES de mirar CAM 2A: golpeará el blindaje drenando algo de energía pero salvarás la vida.',
  },
  {
    id: 'echenique',
    name: 'Echenique-Golden Freddy',
    alias: 'La Anomalía Dorada (1/1000)',
    fnafCounterpart: 'Golden Freddy',
    portraitUrl: './assets/aistudio/image_6fafc05d.png',
    wing: 'Anomalía Paranormal (Póster CAM 2B → Interior del Despacho)',
    accentColor: '#eab308',
    signatureItem: 'Traje Dorado Desplomado, Chistera Oscura y Alucinación "¡SOY YO!"',
    behaviorSummary:
      'Ignora las puertas blindadas con una probabilidad de 1 entre 1000 al subir y bajar el monitor de cámaras. Se manifiesta desplomado frente a tu escritorio provocando alucinaciones visuales.',
    counterplayTip:
      'Si aparece frente a tu escritorio en el despacho, sube inmediatamente el monitor CCTV [Espacio] en menos de 2.5 segundos para que se desvanezca o te matará al instante.',
  },
];

export const PHONE_GUY_CALLS: Record<number, string[]> = {
  1: [
    '¿Hola? ¿Hola, me recibes? Bienvenido a tu primer turno nocturno en el Complejo de La Moncloa.',
    'Por motivos de ahorro energético del Ministerio, tienes una batería limitada para toda la noche hasta las 6:00 AM.',
    'Los cuatro animatrónicos parlamentarios tienen modo de "deambulación libre" nocturna para que no se les bloqueen los servos.',
    'Revisa las luces de los pasillos [Q y E] y el monitor CCTV [Espacio]. Cierra las puertas blindadas [A y D] solo si ves a alguien en el umbral.',
  ],
  2: [
    '¡Hola de nuevo! Enhorabuena por superar la primera noche. Hoy los animatrónicos estarán bastante más activos.',
    'Ojo con Abascal-Foxy en la Cala 1C: no le gusta que lo ignoren por completo. Abre el monitor de vez en cuando para contenerlo.',
    'Si ves que ha desaparecido de la cortina 1C, cierra la Puerta Izquierda [A] de inmediato antes de mirar el Pasillo Oeste 2A.',
    'Recuerda que Rajoy-Bonnie aparece en el punto ciego de la puerta izquierda y Montero-Chica asoma por la ventana derecha.',
  ],
  3: [
    '¡Noche 3! La cosa se pone seria en el Hemiciclo. Pedro-Freddy ya empieza a bajar de la Tribuna de Honor.',
    'Pedro se mueve por el Ala Este en la oscuridad. Cada vez que escuchas su risa grave, ha avanzado una sala hacia tu despacho.',
    'El truco para frenar a Pedro es vigilarlo en la cámara 4B. Mientras lo mires en el monitor, sus servos se detienen.',
  ],
  4: [
    '¿Hola? ¿Sigues ahí? Escucha... esta noche los cuatro están en alerta máxima. Apenas me queda tiempo para hablar.',
    'Si alguno se cuela en el despacho mientras miras las cámaras, atascará los botones de la puerta y luz de ese lado.',
    'Si oyes que los botones hacen un zumbido de error... no bajes el monitor hasta las 6:00 AM o te saltará encima.',
  ],
  5: [
    '[TRANSMISIÓN DISTORSIONADA] ...Atención guardia... los niveles de actividad autónoma han superado el protocolo de seguridad...',
    'Conserva cada 1% de batería. Mantén vigilada la cámara 4B para Pedro-Freddy y escucha los pasos de Abascal-Foxy en el oeste. ¡Suerte!',
  ],
};

export interface NightSimulationState {
  nightNumber: number; // 1 to 6 (6 = Custom Night)
  baseAI: AnimatronicAILevels;
  elapsedSeconds: number; // 0 to 270 (45s per hour * 6 hours)
  hourDurationSeconds: number; // Default 45s per hour
  currentHour: number; // 0 (12 AM), 1, 2, 3, 4, 5, 6 (Victory)
  powerTenths: number; // 1000 = 100.0%, 0 = 0.0%
  usageLevel: number; // 1 to 5
  leftDoorClosed: boolean;
  rightDoorClosed: boolean;
  leftLightOn: boolean;
  rightLightOn: boolean;
  leftJammed: boolean;
  rightJammed: boolean;
  monitorOpen: boolean;
  activeCam: CameraId;
  cameraStaticTimer: number; // > 0 when an animatronic moves on the watched cam
  fanOn: boolean;

  // Animatronic states
  pedroLocation: AnimatronicLocation;
  rajoyLocation: AnimatronicLocation;
  monteroLocation: AnimatronicLocation;
  abascalStage: 0 | 1 | 2 | 3; // 0: closed, 1: peeking, 2: out, 3: gone/sprinting
  abascalSprinting: boolean;
  abascalSprintProgress: number; // 0 to 1 down CAM_2A
  abascalWaitTimer: number; // Countdown once at stage 3 before forced sprint
  abascalStallTimer: number; // Cooldown after closing monitor where Abascal is stalled
  abascalBangsCount: number; // Number of times Abascal banged the left door
  endo03Active: boolean; // 1/1000 Easter Egg in CAM_3 when Rajoy is not present
  goldenFreddyPosterActive: boolean; // 1/1000 Easter Egg on CAM_2B poster / monitor open
  goldenFreddyActive: boolean; // Echenique-Golden Freddy slumped inside the office
  goldenFreddyTimer: number; // Seconds spent in office with Golden Freddy (> 2.5s = fatal jumpscare)

  // Movement timers
  pedroTimer: number;
  rajoyTimer: number;
  monteroTimer: number;
  abascalTimer: number;

  // Door wait timers (how long Rajoy/Montero stay outside door before leaving or entering)
  rajoyDoorTimer: number;
  monteroDoorTimer: number;
  pedroCornerTimer: number;

  // Power Outage sequence
  powerOutage: boolean;
  outagePhase: 'none' | 'dark_wait' | 'toreador_song' | 'pitch_black' | 'jumpscare';
  outageTimer: number;

  // Victory / Defeat
  status: 'playing' | 'victory' | 'defeat';
  jumpscareBy: AnimatronicId | null;
  jumpscareTimer: number; // Animates jumpscare frames before showing modal
  lastEventBanner: string | null;
  lastAudioCue:
    | 'none'
    | 'pedro_laugh'
    | 'kitchen_clatter'
    | 'foxy_sprint'
    | 'foxy_bang'
    | 'window_scare'
    | 'door_jammed'
    | 'power_down'
    | 'jumpscare'
    | 'golden_laugh'
    | 'golden_jumpscare'
    | 'victory_chime';
  audioCueCounter: number;
}

export interface RunSummarySnapshot {
  outcome: 'victory' | 'defeat';
  nightNumber: number;
  hourReached: string;
  powerRemainingPercent: number;
  jumpscareBy: AnimatronicId | null;
  causeOfDefeat: string;
  abascalBangs: number;
  aiLevels: AnimatronicAILevels;
}
