export type RoomCameraId =
  | 'CAM_01'
  | 'CAM_02'
  | 'CAM_03'
  | 'CAM_04'
  | 'CAM_05'
  | 'CAM_06'
  | 'CAM_07'
  | 'CAM_08'
  | 'CAM_09'
  | 'CAM_10';

export type VentCameraId =
  | 'CAM_11'
  | 'CAM_12'
  | 'CAM_13'
  | 'CAM_14'
  | 'CAM_15';

export type CameraId = RoomCameraId | VentCameraId;

export type AuronPosition =
  | CameraId
  | 'WINDOW'
  | 'DOORWAY'
  | 'OFFICE_ATTACK';

export type CharacterId =
  | 'AURONPLAY'
  | 'RUBIUS_CHEPUDO'
  | 'CRISTININI'
  | 'CHIQUI_IBAI'
  | 'ISHOWSPEED'
  | 'ARIGAMEPLAYS'
  | 'KNEKRO';

export const STREAMER_HEAD_IMAGES: Record<CharacterId, string> = {
  AURONPLAY: './assets/aistudio/image_a1fd6d5f.png',
  KNEKRO: './assets/aistudio/image_70c3a5a9.png',
  RUBIUS_CHEPUDO: './assets/aistudio/image_d33c5ca6.png',
  CRISTININI: './assets/aistudio/image_bd655330.png',
  CHIQUI_IBAI: './assets/aistudio/image_d6650af4.png',
  ISHOWSPEED: './assets/aistudio/image_8d1bc70f.png',
  ARIGAMEPLAYS: './assets/aistudio/image_faace05e.png',
};

/**
 * Tightly-cropped face-only bounding boxes (normalized 0..1 of source image)
 * so ONLY the streamer's face (forehead to chin, zero background or torso)
 * fills the split Upper Animatronic Mask + Lower Articulated Jaw.
 */
export const FACE_CROP_CONFIG: Record<
  CharacterId,
  { src: string; cx: number; cy: number; cw: number; ch: number }
> = {
  AURONPLAY: { src: STREAMER_HEAD_IMAGES.AURONPLAY, cx: 0.27, cy: 0.23, cw: 0.46, ch: 0.52 },
  KNEKRO: { src: STREAMER_HEAD_IMAGES.KNEKRO, cx: 0.29, cy: 0.09, cw: 0.28, ch: 0.36 },
  RUBIUS_CHEPUDO: { src: STREAMER_HEAD_IMAGES.RUBIUS_CHEPUDO, cx: 0.33, cy: 0.14, cw: 0.25, ch: 0.25 },
  CRISTININI: { src: STREAMER_HEAD_IMAGES.CRISTININI, cx: 0.46, cy: 0.17, cw: 0.35, ch: 0.42 },
  CHIQUI_IBAI: { src: STREAMER_HEAD_IMAGES.CHIQUI_IBAI, cx: 0.18, cy: 0.15, cw: 0.41, ch: 0.27 },
  ISHOWSPEED: { src: STREAMER_HEAD_IMAGES.ISHOWSPEED, cx: 0.22, cy: 0.10, cw: 0.33, ch: 0.32 },
  ARIGAMEPLAYS: { src: STREAMER_HEAD_IMAGES.ARIGAMEPLAYS, cx: 0.36, cy: 0.11, cw: 0.27, ch: 0.36 },
};

export interface CameraNode {
  id: CameraId;
  label: string;
  name: string;
  isVent: boolean;
  // Coordinates on the FNAF 3 Map (percentage 0-100)
  x: number;
  y: number;
  connectedRooms: AuronPosition[];
  connectedVents: VentCameraId[];
  leadsToOffice?: 'DOORWAY' | 'WINDOW' | 'OFFICE_ATTACK';
  description: string;
}

export const CAMERA_NODES: Record<CameraId, CameraNode> = {
  CAM_01: {
    id: 'CAM_01',
    label: 'CAM 01',
    name: 'Salida Fiscal (Exit Hall)',
    isVent: false,
    x: 42,
    y: 80,
    connectedRooms: ['CAM_02', 'DOORWAY'],
    connectedVents: [],
    leadsToOffice: 'DOORWAY',
    description: 'Pasillo directo a la puerta izquierda de la oficina de Hacienda.',
  },
  CAM_02: {
    id: 'CAM_02',
    label: 'CAM 02',
    name: 'Pasillo Aduana (Front Hall)',
    isVent: false,
    x: 68,
    y: 76,
    connectedRooms: ['CAM_01', 'CAM_03', 'CAM_05', 'WINDOW'],
    connectedVents: ['CAM_15'],
    leadsToOffice: 'WINDOW',
    description: 'Conecta directamente con el cristal frontal de la oficina y el conducto CAM 15.',
  },
  CAM_03: {
    id: 'CAM_03',
    label: 'CAM 03',
    name: 'Despacho Contable',
    isVent: false,
    x: 84,
    y: 78,
    connectedRooms: ['CAM_02', 'CAM_04'],
    connectedVents: [],
    description: 'Esquina derecha inferior llena de facturas sin declarar.',
  },
  CAM_04: {
    id: 'CAM_04',
    label: 'CAM 04',
    name: 'Galería Streamer (East Hall)',
    isVent: false,
    x: 80,
    y: 52,
    connectedRooms: ['CAM_03', 'CAM_05', 'CAM_06'],
    connectedVents: [],
    description: 'Pasillo con trofeos de diamante de YouTube y micrófonos colgantes.',
  },
  CAM_05: {
    id: 'CAM_05',
    label: 'CAM 05',
    name: 'Pasillo Central Pirineos',
    isVent: false,
    x: 48,
    y: 54,
    connectedRooms: ['CAM_02', 'CAM_04', 'CAM_06', 'CAM_08'],
    connectedVents: ['CAM_14'],
    description: 'Corredor principal hacia las oficinas VIP de Andorra la Vella.',
  },
  CAM_06: {
    id: 'CAM_06',
    label: 'CAM 06',
    name: 'Cruce de Servidores',
    isVent: false,
    x: 56,
    y: 38,
    connectedRooms: ['CAM_04', 'CAM_05', 'CAM_07'],
    connectedVents: [],
    description: 'Pasillo sombrío con cables de fibra óptica andorrana.',
  },
  CAM_07: {
    id: 'CAM_07',
    label: 'CAM 07',
    name: 'Sala Arcade 3,99$',
    isVent: false,
    x: 42,
    y: 26,
    connectedRooms: ['CAM_06', 'CAM_08'],
    connectedVents: ['CAM_13'],
    description: 'Sala recreativa donde está la máquina arcade de AriGameplays.',
  },
  CAM_08: {
    id: 'CAM_08',
    label: 'CAM 08',
    name: 'Pasillo del Abuelo (KNekro)',
    isVent: false,
    x: 24,
    y: 44,
    connectedRooms: ['CAM_05', 'CAM_07', 'CAM_09'],
    connectedVents: ['CAM_12'],
    description: 'Pasillo donde aparece KNekro (Phantom Puppet). ¡Cambia de cámara si lo ves!',
  },
  CAM_09: {
    id: 'CAM_09',
    label: 'CAM 09',
    name: 'Búnker Andorra Norte',
    isVent: false,
    x: 28,
    y: 16,
    connectedRooms: ['CAM_08', 'CAM_10'],
    connectedVents: ['CAM_11'],
    description: 'Punto de inicio de AuronPlay (Springtrap) en las montañas.',
  },
  CAM_10: {
    id: 'CAM_10',
    label: 'CAM 10',
    name: 'Cámara Acorazada Offshore',
    isVent: false,
    x: 78,
    y: 18,
    connectedRooms: ['CAM_09', 'CAM_07'],
    connectedVents: ['CAM_14'],
    description: 'Sala lejana con acceso directo al conducto rápido CAM 14 hacia tu oficina.',
  },
  // VENT CAMERAS (CAM 11 - CAM 15)
  CAM_11: {
    id: 'CAM_11',
    label: 'CAM 11',
    name: 'Conducto Norte (CAM 09 → 07)',
    isVent: true,
    x: 48,
    y: 14,
    connectedRooms: ['CAM_07'],
    connectedVents: [],
    description: 'Conducto de ventilación superior desde CAM 09.',
  },
  CAM_12: {
    id: 'CAM_12',
    label: 'CAM 12',
    name: 'Conducto Oeste (CAM 08 → CAM 01)',
    isVent: true,
    x: 14,
    y: 64,
    connectedRooms: ['CAM_01'],
    connectedVents: [],
    description: 'Conducto lateral izquierdo directo a la Salida Fiscal (CAM 01).',
  },
  CAM_13: {
    id: 'CAM_13',
    label: 'CAM 13',
    name: 'Conducto Arcade (CAM 07 → CAM 01)',
    isVent: true,
    x: 32,
    y: 60,
    connectedRooms: ['CAM_01'],
    connectedVents: [],
    description: 'Conducto que baja desde el Arcade hasta la puerta de la oficina.',
  },
  CAM_14: {
    id: 'CAM_14',
    label: 'CAM 14',
    name: 'Conducto Directo (CAM 10/05 → OFICINA)',
    isVent: true,
    x: 88,
    y: 38,
    connectedRooms: ['OFFICE_ATTACK'],
    connectedVents: [],
    leadsToOffice: 'OFFICE_ATTACK',
    description: '¡PELIGRO! Conducto directo al interior de tu oficina de Hacienda.',
  },
  CAM_15: {
    id: 'CAM_15',
    label: 'CAM 15',
    name: 'Conducto Aduana (CAM 02 → OFICINA)',
    isVent: true,
    x: 68,
    y: 90,
    connectedRooms: ['OFFICE_ATTACK'],
    connectedVents: [],
    leadsToOffice: 'OFFICE_ATTACK',
    description: '¡PELIGRO! Conducto corto desde CAM 02 directo a tu silla de inspector.',
  },
};

export const ROOM_CAMERAS: RoomCameraId[] = [
  'CAM_01',
  'CAM_02',
  'CAM_03',
  'CAM_04',
  'CAM_05',
  'CAM_06',
  'CAM_07',
  'CAM_08',
  'CAM_09',
  'CAM_10',
];

export const VENT_CAMERAS: VentCameraId[] = [
  'CAM_11',
  'CAM_12',
  'CAM_13',
  'CAM_14',
  'CAM_15',
];

export interface CharacterDossier {
  id: CharacterId;
  youtuberName: string;
  fnafCounterpart: string;
  roleBadge: string;
  dangerType: 'LETAL' | 'FANTASMA';
  mechanicSummary: string;
  counterplay: string;
  quote: string;
}

export const CHARACTER_DOSSIERS: CharacterDossier[] = [
  {
    id: 'AURONPLAY',
    youtuberName: 'AuronPlay',
    fnafCounterpart: 'Springtrap',
    roleBadge: 'ÚNICO LETAL · EVASOR SUPREMO',
    dangerType: 'LETAL',
    mechanicSummary:
      'Se mueve por las salas (CAM 01–10) y se arrastra por los conductos de ventilación (CAM 11–15). Si llega a la ventana frontal, a la puerta izquierda o cruza un conducto sin sellar, te embarga la vida.',
    counterplay:
      'Usa "PLAY AUDIO" ("¡Abduzcan!") en una cámara adyacente para alejarlo. Si entra en un conducto (CAM 11–15), cambia al mapa de ventilación y haz DOBLE CLIC en esa cámara para sellar la compuerta.',
    quote: '«¡Que no pago el IRPF en España, calvo de Hacienda! ¡Abduzcan!»',
  },
  {
    id: 'RUBIUS_CHEPUDO',
    youtuberName: 'El Rubius (Chepudo)',
    fnafCounterpart: 'Phantom Freddy',
    roleBadge: 'POSTURA GAMER · VENTANA FRONTAL',
    dangerType: 'FANTASMA',
    mechanicSummary:
      'Aparece caminando lentamente y encorvado con una chepa monumental por detrás del cristal frontal de la oficina.',
    counterplay:
      'NO te quedes mirándolo en la oficina. Abre el Monitor de Cámaras o el Panel de Mantenimiento y espera a que termine de cruzar el pasillo.',
    quote: '«Ostia tío, mi espalda... llevo 14 horas streameando Rust en Andorra...»',
  },
  {
    id: 'CRISTININI',
    youtuberName: 'Cristinini',
    fnafCounterpart: 'Phantom Mangle',
    roleBadge: 'COLGADA DEL TECHO · CAM 04',
    dangerType: 'FANTASMA',
    mechanicSummary:
      'Aparece colgada del techo entre cables de micrófono en la CAM 04. Si la miras demasiado, se asoma tras el cristal de la oficina con un ruido ensordecedor que rompe el Dispositivo de Audio.',
    counterplay:
      'En cuanto la veas colgada en la CAM 04, cambia inmediatamente de cámara o baja el monitor.',
    quote: '«¡Hola chicos! ¿Se me escucha bien el micro o os rompo el sistema de audio?»',
  },
  {
    id: 'CHIQUI_IBAI',
    youtuberName: 'Chiqui-Ibai',
    fnafCounterpart: 'Phantom Balloon Boy',
    roleBadge: 'MINIATURA GIGANTE · TODAS LAS CÁMARAS',
    dangerType: 'FANTASMA',
    mechanicSummary:
      'Su cara regordeta con gorra de hélice aparece de golpe ocupando toda la lente de cualquier cámara de sala.',
    counterplay:
      'Cambia de cámara o cierra el monitor en menos de 1.2 segundos o saltará sobre ti apagando la Ventilación.',
    quote: '«¡Bueeenas tardes amigos de la Velada! ¡Te robo el oxígeno de la oficina!»',
  },
  {
    id: 'ISHOWSPEED',
    youtuberName: 'IShowSpeed',
    fnafCounterpart: 'Phantom Foxy',
    roleBadge: 'LADRIDO EN LA OFICINA · ESQUINA IZQUIERDA',
    dangerType: 'FANTASMA',
    mechanicSummary:
      'Aparece de pie junto a la caja de reliquias en la parte izquierda de tu oficina cuando bajas el monitor de cámaras.',
    counterplay:
      'Panea con cuidado hacia la izquierda al cerrar las cámaras. Si lo ves agazapado, vuelve a abrir el monitor derecha rápido antes de mirar del todo a la izquierda.',
    quote: '«ARF! ARF! SEWY!! RONALDO EN ANDORRA BRO!! BARK BARK!!»',
  },
  {
    id: 'ARIGAMEPLAYS',
    youtuberName: 'AriGameplays (3,99$)',
    fnafCounterpart: 'Phantom Chica',
    roleBadge: 'MÁQUINA ARCADE CAM 07 · 3,99$',
    dangerType: 'FANTASMA',
    mechanicSummary:
      'Su rostro real aparece dentro de la pantalla de la máquina recreativa en la CAM 07 con un cartel luminoso de "3,99$" justo debajo.',
    counterplay:
      'Si ves su cara y el precio de "3,99$" en la máquina arcade de la CAM 07, cambia de cámara al instante o aparecerá a la izquierda de tu oficina para asustarte.',
    quote: '«¡Suscríbete por solo 3,99$ o te apago la ventilación de Hacienda!»',
  },
  {
    id: 'KNEKRO',
    youtuberName: 'KNekro',
    fnafCounterpart: 'Phantom Puppet',
    roleBadge: 'BLOQUEO EN OFICINA · CAM 08',
    dangerType: 'FANTASMA',
    mechanicSummary:
      'Aparece de pie en el pasillo de la CAM 08 ajustándose la corbata. Si no cambias de cámara rápido, se planta pegado a tu cara en la oficina siguiendo tu vista e impidiéndote abrir las cámaras o el panel durante varios segundos.',
    counterplay:
      'En cuanto veas a KNekro en la CAM 08, cambia de cámara en menos de 1,3 segundos para evitar que te bloquee la oficina y rompa la ventilación.',
    quote: '«¡Pero esto qué es, chavales! Me pongo delante de tu cara y no ves ni las cámaras.»',
  },
];

