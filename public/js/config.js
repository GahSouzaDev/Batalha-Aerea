// config.js
const DEFAULT_KEYBINDS = {
  throttle: 'Space',
  climbUp: 'KeyS',
  climbDown: 'KeyW',
  rollLeft: 'KeyA',
  rollRight: 'KeyD',
  bomb: 'Digit1',
  missile: 'Digit2',
  special: 'Digit3',
  freeCam: 'KeyC',
  camUp: 'ArrowDown',
  camDown: 'ArrowUp',
  camLeft: 'ArrowLeft',
  camRight: 'ArrowRight',
  // Chat de voz: em modo "Aperte para falar" segura pra transmitir; em
  // modo "Sempre ligado" funciona como atalho rápido de mutar/desmutar.
  voicePTT: 'ShiftLeft',
};

let keybinds = { ...DEFAULT_KEYBINDS };

// ================================================================
//  GAMEPAD (Xbox) — mapeamento padrão dos botões (Gamepad API "standard"):
//  0=A 1=B 2=X 3=Y 4=LB 5=RB 6=LT 7=RT 8=View 9=Menu 10=L3 11=R3
//  12=D-cima 13=D-baixo 14=D-esquerda 15=D-direita
//  Analógico esquerdo = eixos 0(x)/1(y) -> movimento (W/A/S/D)
//  Analógico direito  = eixos 2(x)/3(y) -> câmera/mira
// ================================================================
const DEFAULT_GAMEPAD_BINDS = {
  throttle: 0,  // A = acelerador
  esc: 3,       // Y = esc/pausa
  bomb: 4,      // LB = bomba (1)
  special: 5,   // RB = especial (3)
  missile: 6,   // LT = míssil reforçado (2)
  shoot: 7,     // RT = tiro básico
  mic: 10,      // L3 (clique do analógico esquerdo) = chat de voz (PTT ou mutar/desmutar)
};
let gamepadBinds = { ...DEFAULT_GAMEPAD_BINDS };
const GAMEPAD_BUTTON_LABELS = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3', 12: 'D-Cima', 13: 'D-Baixo', 14: 'D-Esq', 15: 'D-Dir',
};
const GAMEPAD_DEADZONE = 0.22;

const HITBOX_SCALE = 1.6;

const MAP_INFO = {
  cidade: { icon: '🏙️', label: 'Cidade' },
  deserto: { icon: '🏜️', label: 'Deserto' },
  floresta: { icon: '🌲', label: 'Floresta' },
  laboratorio: { icon: '🔬', label: 'Laboratório' },
};
const MODE_INFO = {
  ffa: { icon: '⚔️', label: 'Todos Contra Todos' },
  teams: { icon: '🚩', label: 'Modo Esquadrões' },
};
const PLANE_MODE_INFO = {
  livre: { icon: '🎮', label: 'Escolha Livre' },
  sorteio: { icon: '🎲', label: 'Sorteio/Votação' },
};
function mapLabel(key) { const m = MAP_INFO[key]; return m ? (m.icon + ' ' + m.label) : key; }
function modeLabel(key) { const m = MODE_INFO[key]; return m ? (m.icon + ' ' + m.label) : key; }
function planeModeLabel(key) { const m = PLANE_MODE_INFO[key]; return m ? (m.icon + ' ' + m.label) : key; }