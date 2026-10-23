# Transición de Inicio de Noche FNAF 3 y Escenarios Únicos en Cámaras Normales (CAM 01 – CAM 10)

Este plan incorpora la transición cinemática de inicio de noche fiel a *Five Nights at Freddy's 3* sincronizada con el efecto de sonido original adjunto, además de dotar a cada una de las **10 cámaras normales (`CAM 01` a `CAM 10`)** de un escenario único y detallado que fusiona el terror de *Fazbear's Fright* con guiños a Andorra, Hacienda y los streamers (manteniendo intactos los conductos de ventilación `CAM 11` a `CAM 15`).

---

## Revisión del Usuario y Decisiones Confirmadas

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Transición de Inicio de Noche (Estilo FNAF 3 + Audio Adjunto)**: Al iniciar cualquier noche, se ejecutará un **barrido de interferencia estática CRT verde** acompañado del efecto de sonido adjunto (`fnaf-3-start-sound`), mostrando el texto clásico **`12:00 AM` / `Noche X`** con vibración y parpadeo VHS antes de realizar un **fundido gradual a negro** hacia la oficina de Hacienda.
> - **Ambientación Única en las 10 Cámaras Normales (`CAM 01` – `CAM 10`)**: Sin tocar las cámaras de los conductos (`CAM 11` – `CAM 15`), cada una de las 10 cámaras de habitaciones y pasillos tendrá su propia arquitectura, objetos de terror de *Fazbear's Fright* (carcasas animatrónicas en pedestales, cables colgantes, cajas de piezas, cabezas vacías iluminadas, tuberías y baldosas) y guiños temáticos de Andorra y cada streamer.

---

## 1. Visión General y Concepto Principal

- **Qué hace**:
  1. **Secuencia Cinemática de Inicio de Noche (`12:00 AM`)**: Reproduce de forma garantizada (mediante decodificación Web Audio API + respaldo HTML5 Audio) el archivo de audio adjunto de inicio de noche de FNAF 3 mientras la pantalla muestra una ráfaga de estática televisiva verde, líneas de barrido CRT horizontales, el indicador `12:00 AM — NOCHE X` con efecto de salto de fotograma y un fundido progresivo a negro que desemboca en la oficina.
  2. **Escenarios Individualizados para `CAM 01` a `CAM 10`**: Reemplaza el fondo genérico compartido de los pasillos por **10 escenarios diferenciados** con iluminación sombría, profundidad en perspectiva y mobiliario propio en cada cámara para que explorar el circuito cerrado se sienta denso, atmosférico y fiel a FNAF 3.
- **Valor clave**: Aumenta la inmersión audiovisual tanto al comenzar cada turno nocturno como al vigilar las cámaras en busca de AuronPlay y los Phantoms.

---

## 2. Experiencia de Usuario y Diseño Visual

### A. Flujo de la Transición de Inicio de Noche (`NIGHT_INTRO`)
1. **Fase 1 — Impacto Estático y Audio FNAF 3 (0.0s – 0.8s)**:
   - Al pulsar *Iniciar Noche*, continuar partida o avanzar de noche, suena inmediatamente el audio adjunto de FNAF 3.
   - Una cortina de nieve estática CRT verde y bandas horizontales de sincronización recorren la pantalla.
2. **Fase 2 — Reloj `12:00 AM` y `Noche X` con Jitter VHS (0.8s – 3.2s)**:
   - El texto `12:00 AM` y `NOCHE X` aparece centrado en tipografía pixelada CRT (`VT323`) sobre fondo negro profundo con sutiles destellos de fósforo verde, aberración cromática y líneas de escaneo en movimiento.
3. **Fase 3 — Fundido a Negro y Entrada a la Oficina (3.2s – 4.2s)**:
   - Mientras la cola reverberante del sonido de FNAF 3 se apaga, la pantalla se funde suavemente a negro y abre la vista de la oficina del Inspector de Hacienda a las 12 AM.

### B. Catálogo Visual de las 10 Cámaras Normales (`CAM 01` – `CAM 10`)

Cada cámara normal conserva la paleta verde/ámbar oxidada de *Fazbear's Fright* (`#070c06`, `#162312`, `#365314`, `#84cc16`) y añade decoración exclusiva:

| Cámara | Nombre en el Mapa | Escenario y Detalles Visuales (FNAF 3 + Andorra/Streamers) |
| :--- | :--- | :--- |
| **CAM 01** | **Salida Fiscal (Exit Hall)** | Puerta doble metálica de emergencia con letrero luminoso rojo `EXIT / FRONTERA ESPAÑA`, carcasa vacía de Freddy en un pedestal lateral, cajas de cartón con sellos de `EMBARGO AEAT` y mangueras de cables en el techo. |
| **CAM 02** | **Pasillo Aduana (Front Hall)** | Vista del pasillo frontal con el ventanal reflectante de la oficina al fondo, lámpara colgante parpadeante, cabeza animatrónica vacía con luz interna en la pared, póster de `BIENVENIDOS A ANDORRA — 0% IRPF` y archivadores metálicos. |
| **CAM 03** | **Despacho Contable** | Escritorio destartalado con monitores CRT antiguos mostrando gráficas de Bitcoin, pilas de carpetas del `MODELO 720`, trituradora de papel echando humo con facturas y dibujos infantiles pegados en el muro de ladrillo. |
| **CAM 04** | **Galería Streamer (East Hall)** | Pasillo de trofeos con placas de Diamante y Oro de YouTube torcidas en la pared, soporte de maniquí animatrónico de Foxy, micrófonos de brazo colgando del techo y rejilla superior abierta (donde se descuelga **Cristinini / Phantom Mangle**). |
| **CAM 05** | **Pasillo Central Pirineos** | Gran corredor de suelo ajedrezado sucio con arcos de tuberías industriales, guirnaldas de estrellas de pizzería caídas, pósters rasgados de la Kings League / Andorra y cabezas de repuesto en estanterías metálicas. |
| **CAM 06** | **Cruce de Servidores** | Racks de servidores con luces LED parpadeantes (`ANDORRA TELECOM / VPN BUNKER`), gruesos mazos de fibra óptica cruzando el suelo, cajas de fusibles abiertas y un endoesqueleto oxidado apoyado en la esquina. |
| **CAM 07** | **Sala Arcade 3,99$** | Sala recreativa completa: además de la máquina principal de **AriGameplays (`3,99$`)**, incluye una segunda recreativa apagada al fondo (`KOI INVADERS`), taburetes de salón arcade, póster neón retro y cables por el suelo. |
| **CAM 08** | **Pasillo del Abuelo (KNekro)** | Pasillo largo y claustrofóbico con lámpara cenital oscilante, estandarte de trofeos de Pokémon / LoL antiguos, caja de regalo abierta de Puppet en la esquina y manchas de humedad en las paredes donde acecha **KNekro**. |
| **CAM 09** | **Búnker Andorra Norte** | Sala acorazada de inicio de **AuronPlay**: puerta blindada de bóveda entreabierta (`CÁMARA ACORAZADA VIP`), lingotes y sacos con el símbolo `€ / ₿`, cadenas colgantes y cadenas de sujeción rotas en el suelo. |
| **CAM 10** | **Sala de Cripto-Minería** | Filas de rigs de tarjetas gráficas con ventiladores girando, conductos de extracción de calor, medidor eléctrico echando chispas (`CONSUMO: 999 kW`) y bidones de refrigerante junto a la entrada del conducto. |

> [!NOTE]
> **Conductos Intactos (`CAM 11` – `CAM 15`)**: Tal como has pedido, las cámaras de los conductos de ventilación no se modifican y mantienen su diseño metálico actual y su mecánica de sellado con doble clic.

---

## 3. Decisiones de Producto y Arquitectura

- **Decisión 1: Reproducción 100% Fiable del Audio de Inicio de Noche**
  - *Enfoque elegido*: Al igual que hicimos con el sonido de la nariz de Freddy, codificaremos los bytes del archivo MP3 adjunto de inicio de noche en un módulo dedicado para decodificarlo con `AudioContext.decodeAudioData` en el motor de sonido, además de mantener el archivo local como respaldo directo.
  - *Por qué*: Garantiza que el rugido metálico de inicio de noche de FNAF 3 suene siempre al instante y sin fallos de carga asíncrona en el navegador.
- **Decisión 2: Escenarios Vectoriales por Cámara con Capas de Profundidad**
  - *Enfoque elegido*: Renderizar cada una de las 10 cámaras normales mediante ilustraciones modulares en perspectiva que se sitúan detrás de la capa de los animatrónicos (`AuronPlay`, `Chiqui-Ibai`, `Cristinini`, `AriGameplays`, `KNekro`), preservando toda la legibilidad cuando un youtuber aparece en la sala.
  - *Por qué*: Permite que cada cámara sea reconocible al instante sin necesidad de leer siquiera el título, al mismo tiempo que mantiene el rendimiento a 60 FPS al cambiar rápidamente entre cámaras.

---

## 4. Arquitectura Técnica y Flujo de Estado

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INICIO DE NOCHE (startNight)                         │
│  1. Activa estado NIGHT_INTRO (4.2 segundos)                            │
│  2. Reproduce audio FNAF 3 adjunto (Web Audio API Buffer + Fallback)    │
│  3. Secuencia Visual:                                                   │
│     [Barrido Estático CRT] ──► [12:00 AM / NOCHE X + VHS] ──► [Fade Out]│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  MONITOR DE CÁMARAS (CameraMonitor)                     │
├───────────────────────────────────┬─────────────────────────────────────┤
│  CÁMARAS NORMALES (CAM 01 - 10)   │   CONDUCTOS (CAM 11 - 15)           │
│  Renderizador de Escenario Único  │   (Se mantienen sin cambios)        │
│  por cada ID de cámara:           │                                     │
│  • CAM 01: Puerta Exit + Pedestal │                                     │
│  • CAM 02: Ventanal + Cabeza Luz  │                                     │
│  • CAM 03: Despacho Modelo 720    │                                     │
│  • CAM 04: Trofeos YT + Cables    │                                     │
│  • CAM 05: Pasillo Pirineos       │                                     │
│  • CAM 06: Racks Andorra Telecom  │                                     │
│  • CAM 07: Sala Recreativa 3,99$  │                                     │
│  • CAM 08: Pasillo KNekro + Caja  │                                     │
│  • CAM 09: Bóveda AuronPlay       │                                     │
│  • CAM 10: Rigs Cripto-Minería    │                                     │
└───────────────────────────────────┴─────────────────────────────────────┘
```
