// plane-specs.js – HABILIDADES VERMELHAS CORRETAS
// ================================================================
// NOMES CORRIGIDOS (pedido):
//  - "jato"  → na verdade é o JAS 39 Gripen (chave interna "jato" mantida
//    de propósito, só o nome de exibição mudou — ver nota abaixo).
//  - "boing" → na verdade é o Airbus A380 (chave interna "boing" mantida).
//  - "cessna" já estava certo: é um Cessna 172.
//  - resto (bimotor/ATR, sr71/SR-71 Blackbird, ovni) já estava certo.
//
// IMPORTANTE sobre as chaves internas (jato/boing) NÃO terem mudado:
// selectedPlaneType, PLANE_BUILDERS, physics.js, abilities.js,
// multiplayer.js etc. usam essas strings ("jato", "boing") em dezenas de
// lugares pra decidir qual habilidade/física aplicar. Renomear a CHAVE
// exigiria caçar e trocar tudo isso, com alto risco de esquecer um lugar
// e quebrar uma habilidade sem perceber. Como o jogo já separa "chave
// interna" de "nome mostrado" (spec.label é o que aparece na tela — ver
// telemetria, cards do menu, placar etc.), só precisei corrigir o label.
// Se um dia quiser MESMO renomear a chave, é só combinar comigo — mas o
// jogo funciona 100% igual do jeito que está, só com o nome certo em tela.
//
// NOVOS AVIÕES (pedido): A-1A AMX, F-22 Raptor, Boeing 737.
// PLANE_ORDER foi reorganizado por categoria (hélice/turboélice → caças
// a jato → alta performance → grandes/comerciais → especial/OVNI).
// ================================================================

if (THREE.Cache) THREE.Cache.enabled = true;
const assetLoadingManager = new THREE.LoadingManager();
const sharedTextureLoader = new THREE.TextureLoader(assetLoadingManager);

const BALANCE_MAX_ALTITUDE = 100;

// ================================================================
//  ORDEM DOS AVIÕES NO MENU — atualizada com os 6 novos (pedido):
//  1) Hélice / turboélice: 14-Bis, Cessna, Hilson Bi-Mono, ATR Bimotor,
//     Piper Seneca
//  2) Caças a jato:        Gripen (jato), AMX, F-22
//  3) Alta performance:    SR-71
//  4) Grandes/comerciais:  A380 (boing), 737 (b737), B-2 Spirit
//  5) Especial:            Helicóptero, OVNI, X-Wing
// ================================================================
const PLANE_ORDER = [
  'quatorzebis', 'cessna', 'biplano', 'bimotor', 'seneca',
  'jato', 'amx', 'f22',
  'sr71',
  'boing', 'b737', 'b2spirit',
  'heli', 'ovni', 'xwing'
];

const PLANE_ICONS = {
  quatorzebis: '🪁',
  cessna: '🛩️',
  biplano: '🎭',
  bimotor: '✈️',
  seneca: '🛧',
  jato: '🚀',
  amx: '🎯',
  f22: '🦅',
  sr71: '⚡',
  boing: '✈️',
  b737: '🛫',
  b2spirit: '🦇',
  heli: '🚁',
  ovni: '🛸',
  xwing: '✨'
};

const PLANE_SPECS = {
  // ============================================================
  //  HÉLICE / TURBOÉLICE
  // ============================================================
  quatorzebis: {
    // NOVO (pedido). "Um pouco pior que o Cessna": mais lento, um pouco
    // menos ágil de giro, e voa BEM mais baixo (maxAltitude reduzido de
    // propósito) — mas ganha uma habilidade de altíssima velocidade.
    label: '14-Bis',
    maxSpeed: 0.5,
    acceleration: 0.00035,
    friction: 0.0005,
    gravity: 0.22,
    crashGravity: 0.9,
    liftThreshold: 0.18,
    maxPitchAngle: Math.PI / 7.5,
    maxAltitude: 42, // "voar mais baixo" — bem abaixo do teto normal (100)
    pitchSpeed: 0.28,
    baseVerticalSpeedUp: 0.038,
    // speedFactor alto: é o que garante que, na Hiper Velocidade, ele vire
    // MUITO mais ágil que o SR-71 invisível (speedFactor do SR-71 é só
    // 0.05) mesmo estando a toda velocidade.
    speedFactor: 0.85,
    baseRotationSpeed: 0.0125,
    inclina: 0.55,
    inclina2: -0.55,
    inclinaBoing: 0.42,
    inclinaBoing2: -0.42,
    special: 'hiper_velocidade_14bis',
    specialLabel: 'Hiper Velocidade',
    specialDesc: 'Acelera progressivamente até 20x a velocidade máxima normal e fica extremamente manobrável e invulnerável por 5s — mais rápido e muito mais ágil que o SR-71 invisível. Não fica invisível: solta um rastro de fogo bem visível atrás',
    sound: 'Cessna sound effect _ Enjoy!.mp3',
    bodyTexture: 'images.png',
  },

  cessna: {
    label: 'Cessna 172',
    maxSpeed: 0.8,
    acceleration: 0.001,
    friction: 0.001,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.25,
    maxPitchAngle: Math.PI / 7,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.03,
    baseVerticalSpeedUp: 0.045,
    speedFactor: 0.4,
    baseRotationSpeed: 0.013,
    inclina: 0.5,
    inclina2: -0.5,
    inclinaBoing: 0.4,
    inclinaBoing2: -0.4,
    special: 'rajada_bombas',
    specialLabel: 'Rajada de Bombas',
    specialDesc: 'Atira 5 bombas vermelhas (2/3 do tamanho normal) para frente, 1 por segundo, na mesma velocidade de um tiro normal — cada uma tira metade da vida (precisa de 2 acertos pra matar)',
    sound: 'bi-motor.mp3',
    tailTexture: 'images.png',
  },

  biplano: {
    // NOVO (pedido). Hilson Bi-Mono: "rápido, meio termo entre o Cessna e
    // o SR-71" (maxSpeed 0.8 -> 1.5, meio termo = ~1.15), manobrabilidade
    // bem próxima do Cessna.
    label: 'Hilson Bi-Mono',
    maxSpeed: 1.15,
    acceleration: 0.0018,
    friction: 0.0016,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.35,
    maxPitchAngle: Math.PI / 7,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.032,
    baseVerticalSpeedUp: 0.06,
    speedFactor: 0.4,
    baseRotationSpeed: 0.013,
    inclina: 0.5,
    inclina2: -0.5,
    inclinaBoing: 0.4,
    inclinaBoing2: -0.4,
    special: 'super_metralhadora',
    specialLabel: 'Super Metralhadora',
    specialDesc: 'Liga uma rajada muito rápida de tiros azuis (mirados pela mira) por 5s — cooldown próprio de só 10s, bem menor que o normal',
    sound: 'Biplano #comissariodevoo #mecanicodeaviao #pilotocomercial #pilotlife #aviação #aviacaogeral #voar - Decolando na Banca (youtube).mp3',
    bodyTexture: 'antigo.png',
  },

  bimotor: {
    label: 'ATR Bimotor',
    maxSpeed: 1.2,
    acceleration: 0.00085,
    friction: 0.001,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.40,
    maxPitchAngle: Math.PI / 8,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.02,
    baseVerticalSpeedUp: 0.050,
    speedFactor: 0.2,
    baseRotationSpeed: 0.01,
    inclina: 0.5,
    inclina2: -0.5,
    inclinaBoing: 0.3,
    inclinaBoing2: -0.3,
    special: 'multi_missile',
    specialLabel: 'Sobrecarga Kamikaze',
    specialDesc: 'Acelera ao máximo e, após 3s, explode com dano em área — fica invulnerável a colisões durante a sobrecarga',
    sound: 'boeing.mp3',
    bodyTexture: 'antigo.png',
    tailTexture: 'ATR.png',
  },

  seneca: {
    // NOVO (pedido). "Melhor, mais manobrável e mais rápido que o ATR".
    label: 'Piper Seneca',
    maxSpeed: 0.95,
    acceleration: 0.00095,
    friction: 0.001,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.38,
    maxPitchAngle: Math.PI / 7.5,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.024,
    baseVerticalSpeedUp: 0.056,
    speedFactor: 0.25,
    baseRotationSpeed: 0.0105,
    inclina: 0.52,
    inclina2: -0.52,
    inclinaBoing: 0.34,
    inclinaBoing2: -0.34,
    special: 'rajada_dupla_seneca',
    specialLabel: 'Rajada Dupla',
    specialDesc: 'Solta um par de mísseis retos de cada asa (esquerda e direita) por segundo, 20 disparos em 5s',
    sound: 'Cessna sound effect _ Enjoy!.mp3',
    bodyTexture: 'image.png',
    tailTexture: 'ATR.png',
  },

  // ============================================================
  //  CAÇAS A JATO
  // ============================================================
  jato: {
    // Chave interna "jato" mantida (ver nota no topo do arquivo) — o avião
    // de verdade é um JAS 39 Gripen.
    label: 'JAS 39 Gripen',
    maxSpeed: 1.5,
    acceleration: 0.0030,
    friction: 0.0025,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.60,
    maxPitchAngle: Math.PI / 6,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.04,
    baseVerticalSpeedUp: 0.08,
    speedFactor: 0.5,
    baseRotationSpeed: 0.01,
    inclina: 0.7,
    inclina2: -0.7,
    inclinaBoing: 0.5,
    inclinaBoing2: -0.5,
    special: 'campo_dano',
    specialLabel: 'Campo de Dano',
    specialDesc: 'Esfera de dano por 5s e invulnerabilidade total: sem colisão, sem dano de tiros, mísseis ou explosões enquanto durar',
    sound: 'Som de avião Caça.mp3',
    bodyTexture: 'camuflagem.png',
    tailTexture: 'FAB.png',
  },

  amx: {
    // NOVO (pedido). Levemente inferior ao Gripen — jato de ataque
    // subsônico, um pouco mais lento e menos ágil.
    label: 'A-1A AMX',
    maxSpeed: 1.35,
    acceleration: 0.0026,
    friction: 0.0024,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.62,
    maxPitchAngle: Math.PI / 6.3,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.037,
    baseVerticalSpeedUp: 0.075,
    speedFactor: 0.45,
    baseRotationSpeed: 0.0095,
    inclina: 0.65,
    inclina2: -0.65,
    inclinaBoing: 0.48,
    inclinaBoing2: -0.48,
    special: 'missil_teleguiado_lento',
    specialLabel: 'Míssil Teleguiado Lento',
    specialDesc: 'Solta 5 mísseis vermelhos lentos (metade da velocidade do tiro normal) que perseguem o alvo mais próximo só nos primeiros 3s de voo — depois seguem em linha reta. Mesmo dano da Rajada do Cessna (2 acertos pra matar)',
    sound: 'Som de avião Caça.mp3',
    bodyTexture: 'camuflagem.png',
  },

  f22: {
    // NOVO (pedido). Superior ao Gripen, no mesmo patamar do SR-71 em
    // velocidade de topo, mas muito mais ágil (thrust vectoring).
    label: 'F-22 Raptor',
    maxSpeed: 1.5,
    acceleration: 0.0034,
    friction: 0.0028,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.55,
    maxPitchAngle: Math.PI / 5,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.045,
    baseVerticalSpeedUp: 0.09,
    speedFactor: 0.35,
    baseRotationSpeed: 0.013,
    inclina: 0.75,
    inclina2: -0.75,
    inclinaBoing: 0.55,
    inclinaBoing2: -0.55,
    special: 'impulso_hipersonico',
    specialLabel: 'Impulso Hipersônico',
    specialDesc: 'Carrega energia por 2s (fica mais lento e invulnerável), solta uma onda de choque explosiva e é arremessado pra frente em altíssima velocidade por 1s — depois volta gradualmente ao normal',
    sound: 'boeing.mp3',
    bodyTexture: 'camuflagem.png',
  },

  // ============================================================
  //  ALTA PERFORMANCE / STEALTH
  // ============================================================
  sr71: {
    label: 'SR-71 Blackbird',
    maxSpeed: 1.55,
    acceleration: 0.0035,
    friction: 0.003,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.80,
    maxPitchAngle: Math.PI / 6,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.05,
    baseVerticalSpeedUp: 0.095,
    speedFactor: 0.05,
    baseRotationSpeed: 0.01,
    inclina: 0.7,
    inclina2: -0.7,
    inclinaBoing: 0.5,
    inclinaBoing2: -0.5,
    special: 'invisibilidade',
    specialLabel: 'Invisibilidade',
    specialDesc: 'Fica invisível para inimigos por 5s e pode acelerar até 2x a velocidade máxima normal durante esse tempo',
    sound: 'boeing.mp3',
    bodyTexture: 'camuflagem.png',
  },

  // ============================================================
  //  GRANDES / COMERCIAIS
  // ============================================================
  boing: {
    // Chave interna "boing" mantida (ver nota no topo do arquivo) — o
    // avião de verdade é um Airbus A380.
    label: 'Airbus A380',
    maxSpeed: 1.5,
    acceleration: 0.0012,
    friction: 0.001,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.45,
    maxPitchAngle: Math.PI / 7,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.035,
    baseVerticalSpeedUp: 0.055,
    speedFactor: 0.3,
    baseRotationSpeed: 0.013,
    inclina: 0.5,
    inclina2: -0.5,
    inclinaBoing: 0.3,
    inclinaBoing2: -0.3,
    special: 'bombardeio',
    specialLabel: 'Bombardeio',
    specialDesc: 'Solta 5 bombas vermelhas em sequência (1/s)',
    sound: 'boeing.mp3',
    bodyTexture: 'image.png',
    tailTexture: 'boeing.png',
  },

  b737: {
    // NOVO (pedido). Avião grande, um pouco menor/mais ágil que o A380.
    label: 'Boeing 737',
    maxSpeed: 1.4,
    acceleration: 0.0013,
    friction: 0.001,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.5,
    maxPitchAngle: Math.PI / 7.5,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.032,
    baseVerticalSpeedUp: 0.05,
    speedFactor: 0.28,
    baseRotationSpeed: 0.011,
    inclina: 0.45,
    inclina2: -0.45,
    inclinaBoing: 0.28,
    inclinaBoing2: -0.28,
    special: 'rastro_luminoso',
    specialLabel: 'Rastro Luminoso',
    specialDesc: 'Deixa um rastro de luz no ar enquanto a habilidade durar (5s) — quem passar por dentro dele sofre o mesmo dano do Laser do OVNI. O rastro se apaga logo depois que a habilidade termina',
    sound: 'boeing.mp3',
    bodyTexture: 'image.png',
    tailTexture: 'boeing.png',
  },

  b2spirit: {
    // NOVO (pedido). "Igual ao A380, só que um pouquinho mais rápido e
    // mais manobrável" — mesma base do A380 com um empurrãozinho em
    // maxSpeed/baseRotationSpeed.
    label: 'Northrop Grumman B-2 Spirit',
    maxSpeed: 1.55,
    acceleration: 0.0012,
    friction: 0.001,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.45,
    maxPitchAngle: Math.PI / 7,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.036,
    baseVerticalSpeedUp: 0.057,
    speedFactor: 0.32,
    baseRotationSpeed: 0.0145,
    inclina: 0.53,
    inclina2: -0.53,
    inclinaBoing: 0.32,
    inclinaBoing2: -0.32,
    special: 'bombardeio_furtivo',
    specialLabel: 'Bombardeio Furtivo',
    specialDesc: 'Solta 10 bombas brancas em sequência (1 a cada meio segundo), caindo 2x mais rápido que as do A380, com raio de explosão menor — bomba, fogo, explosão e onda de choque, tudo branco',
    sound: 'boeing.mp3',
    bodyTexture: 'image.png',
  },

  // ============================================================
  //  ESPECIAL
  // ============================================================
  heli: {
    // NOVO (pedido). Física totalmente própria — ver updateHelicopterFlight
    // em physics.js. maxSpeed aqui representa a POTÊNCIA do motor (as 3
    // faixas de sustentação/pairado/potência total), não velocidade de
    // deslocamento — heliMoveSpeed é quem controla isso.
    label: 'Helicóptero',
    maxSpeed: 1.0,
    acceleration: 0.0012,
    friction: 0.0009,
    gravity: 0.3,
    crashGravity: 0.9,
    liftThreshold: 0.01, // não usado no voo (física própria), mantido por segurança
    maxPitchAngle: Math.PI / 8,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.03,
    baseVerticalSpeedUp: 0.05, // taxa de subida na faixa 3 de potência
    heliMoveSpeed: 0.85,       // velocidade de deslocamento frente/trás (faixas 2 e 3)
    speedFactor: 0.4,
    baseRotationSpeed: 0.016,
    inclina: 0.45,
    inclina2: -0.45,
    inclinaBoing: 0.3,
    inclinaBoing2: -0.3,
    special: 'onda_de_choque_heli',
    specialLabel: 'Onda de Choque',
    specialDesc: '5 pulsos de onda de choque (1 por segundo) — grande, grossa e bem visível, dano em área em todas as direções, sem explosão de partículas. Precisa de 2 pulsos pra matar',
    sound: 'boeing.mp3',
    bodyTexture: 'camuflagem.png',
  },

  ovni: {
    label: 'OVNI',
    maxSpeed: 1.5,
    acceleration: 0.0035,
    friction: 0.0025,
    gravity: 0.01,
    crashGravity: 0.9,
    liftThreshold: 0.01,
    maxPitchAngle: Math.PI / 4,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.05,
    baseVerticalSpeedUp: 0.1,
    speedFactor: 0.05,
    baseRotationSpeed: 0.03,
    inclina: 0.8,
    inclina2: -0.8,
    inclinaBoing: 0.6,
    inclinaBoing2: -0.6,
    special: 'laser',
    specialLabel: 'Laser Destruidor',
    specialDesc: 'Dispara um laser contínuo por 5s (vermelho, dano altíssimo)',
    sound: 'Decolagem do 777 Emirates. Se liga no som dos motores.mp3',
    bodyTexture: 'ovni.png',
  },

  xwing: {
    // NOVO (pedido). Comportamento igual ao OVNI (bem ágil/manobrável),
    // sendo a melhor de todas — mas só um pouquinho melhor que o OVNI.
    label: 'X-Wing (T-65/T-70)',
    maxSpeed: 1.55,
    acceleration: 0.0037,
    friction: 0.0025,
    gravity: 0.01,
    crashGravity: 0.9,
    liftThreshold: 0.01,
    maxPitchAngle: Math.PI / 4,
    maxAltitude: BALANCE_MAX_ALTITUDE,
    pitchSpeed: 0.052,
    baseVerticalSpeedUp: 0.105,
    speedFactor: 0.06,
    baseRotationSpeed: 0.032,
    inclina: 0.82,
    inclina2: -0.82,
    inclinaBoing: 0.62,
    inclinaBoing2: -0.62,
    special: 'metralhadora_laser',
    specialLabel: 'Metralhadora Laser',
    specialDesc: 'Dispara um laser azul em rajadas de 10 disparos por segundo (liga e desliga, como uma metralhadora) por 5s',
    sound: 'Decolagem do 777 Emirates. Se liga no som dos motores.mp3',
    bodyTexture: 'ovni.png',
  },
};

const PLANE_BUILDERS = {};