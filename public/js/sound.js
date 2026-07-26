// ================================================================
//  SOM (sintetizado via WebAudio - não depende de arquivos externos)
// ================================================================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
window.addEventListener('click', () => ensureAudio(), { once: true });
window.addEventListener('keydown', () => ensureAudio(), { once: true });

function beep(freqStart, freqEnd, duration, type, gain) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), ctx.currentTime + duration);
  g.gain.setValueAtTime(gain || 0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration);
}

// Toca uma sequência de bipes agendados (delays em ms a partir de agora),
// útil pra sons "característicos" mais longos/reconhecíveis do que um
// beep() único (sirene, trava de míssil, carga de energia etc.).
function beepSequence(steps) {
  steps.forEach(([delayMs, freqStart, freqEnd, duration, type, gain]) => {
    setTimeout(() => beep(freqStart, freqEnd, duration, type, gain), delayMs);
  });
}

function playSound(name) {
  // PEDIDO: opção "Sem som no jogo" no menu/lobby — variável definida em
  // ui-menu.js (gameSoundMuted). Checado com typeof pra não quebrar caso
  // esse arquivo carregue antes (não é o caso hoje, mas é mais seguro).
  if (typeof gameSoundMuted !== 'undefined' && gameSoundMuted) return;
  try {
    switch (name) {
      case 'shot': beep(1400, 500, 0.05, 'square', 0.06); break;
      case 'hit': beep(700, 200, 0.12, 'sawtooth', 0.08); break;
      case 'explosion': beep(180, 40, 0.5, 'sawtooth', 0.15); break;
      case 'death': beep(300, 30, 0.8, 'sawtooth', 0.18); break;
      case 'victory': beep(500, 1200, 0.4, 'triangle', 0.1); break;
      case 'special': beep(400, 1000, 0.3, 'sine', 0.1); break;
      case 'start': beep(200, 500, 0.3, 'sine', 0.1); break;
      case 'checkpoint': beep(600, 900, 0.2, 'sine', 0.1); break;

      // PEDIDO: som próprio e curtinho pro carrossel de aviões (menu,
      // lobby e modal de troca de avião), tocado a cada clique nas
      // setas — um "tick" ascendente rápido, discreto.
      case 'plane_switch': beep(900, 1500, 0.07, 'sine', 0.07); break;

      // Helicóptero — pulso de onda de choque: estouro grave e curto
      // seguido de um "anel" agudo metálico, sem o chiado longo da
      // explosão normal (é onda de choque, não fogo).
      case 'shockwave_pulse':
        beepSequence([
          [0, 130, 45, 0.22, 'square', 0.16],
          [40, 2000, 700, 0.18, 'sine', 0.08],
        ]);
        break;

      // ============================================================
      // SONS DE HABILIDADE ESPECIAL — um "timbre" só seu por avião, pra
      // dar pra reconhecer de ouvido qual habilidade está sendo usada,
      // mesmo sem olhar pra tela (seu, ou de outro jogador na sala).
      // ============================================================

      // AMX — trava de míssil teleguiado: bipes agudos e curtos que
      // aceleram, igual ao tom clássico de "lock-on" de caça.
      case 'special_amx':
        beepSequence([
          [0, 1900, 1700, 0.05, 'square', 0.07],
          [180, 1900, 1700, 0.05, 'square', 0.07],
          [340, 1900, 1700, 0.05, 'square', 0.07],
          [470, 1900, 1700, 0.05, 'square', 0.08],
          [580, 1900, 1700, 0.05, 'square', 0.08],
          [670, 1900, 1700, 0.05, 'square', 0.08],
          [750, 1900, 1700, 0.05, 'square', 0.09],
          [810, 1900, 1700, 0.05, 'square', 0.09],
          [860, 2200, 1600, 0.16, 'square', 0.11],
        ]);
        break;

      // Bimotor — sobrecarga kamikaze: sirene de alarme subindo/descendo.
      case 'special_bimotor':
        beepSequence([
          [0, 300, 900, 0.35, 'sawtooth', 0.1],
          [350, 900, 300, 0.35, 'sawtooth', 0.1],
          [700, 300, 900, 0.35, 'sawtooth', 0.1],
        ]);
        break;

      // Jato (Gripen) — campo de dano/escudo: hum eletrônico grave e
      // contínuo, tipo campo de força ligando.
      case 'special_jato':
        beepSequence([
          [0, 90, 220, 0.4, 'sine', 0.12],
          [0, 260, 260, 0.4, 'triangle', 0.05],
        ]);
        break;

      // SR-71 — invisibilidade: "whoosh" suave descendente, como um
      // desaparecimento.
      case 'special_sr71':
        beep(1600, 200, 0.55, 'sine', 0.08);
        break;

      // OVNI — laser destruidor: carga sci-fi ascendente antes do raio.
      case 'special_ovni':
        beepSequence([
          [0, 300, 2000, 0.3, 'sawtooth', 0.08],
          [300, 2000, 1800, 0.5, 'sine', 0.1],
        ]);
        break;

      // A380 (boing) — bombardeio: sirene grave de porão de bombas.
      case 'special_boing':
        beepSequence([
          [0, 220, 120, 0.3, 'square', 0.09],
          [320, 220, 120, 0.3, 'square', 0.09],
        ]);
        break;

      // F-22 — impulso hipersônico: carga de energia crescente terminando
      // num estouro agudo (a onda de choque em si já tem seu 'explosion').
      case 'special_f22':
        beepSequence([
          [0, 150, 700, 1.6, 'sine', 0.09],
          [1600, 900, 1400, 0.2, 'square', 0.14],
        ]);
        break;

      // Boeing 737 — rastro luminoso: tom cristalino/etéreo, tipo chime.
      case 'special_b737':
        beepSequence([
          [0, 1200, 1800, 0.25, 'sine', 0.07],
          [180, 1800, 2400, 0.3, 'sine', 0.06],
        ]);
        break;

      // Cessna — rajada de bombas: reaproveita o tom padrão (nada de
      // muito característico pra pedir aqui, é uma rajada simples).
      case 'special_cessna':
        beep(400, 1000, 0.3, 'sine', 0.1);
        break;

      // 14-Bis — Hiper Velocidade: motor "vencendo o vento", grave subindo
      // rápido até um assobio agudo (sensação de arrancada).
      case 'special_quatorzebis':
        beepSequence([
          [0, 200, 260, 0.5, 'sawtooth', 0.11],
          [80, 260, 2200, 0.9, 'sine', 0.09],
        ]);
        break;

      // Hilson Bi-Mono — Super Metralhadora: tambor de metralhadora
      // ligando, tipo "rrrrrat" grave e mecânico.
      case 'special_biplano':
        beepSequence([
          [0, 220, 180, 0.06, 'square', 0.1],
          [70, 220, 180, 0.06, 'square', 0.1],
          [140, 220, 180, 0.06, 'square', 0.1],
          [210, 220, 180, 0.06, 'square', 0.1],
        ]);
        break;

      // Piper Seneca — Rajada Dupla: dois "clacks" metálicos de trava,
      // um pra cada asa.
      case 'special_seneca':
        beepSequence([
          [0, 900, 600, 0.09, 'square', 0.1],
          [110, 900, 600, 0.09, 'square', 0.1],
        ]);
        break;

      // B-2 Spirit — Bombardeio Furtivo: tom etéreo/grave, tipo porão de
      // bombas abrindo em silêncio (mais suave que a sirene do A380).
      case 'special_b2spirit':
        beepSequence([
          [0, 500, 130, 0.5, 'sine', 0.08],
          [250, 1400, 1800, 0.3, 'sine', 0.05],
        ]);
        break;

      // Helicóptero — carregamento grave de energia antes dos pulsos.
      case 'special_heli':
        beepSequence([
          [0, 100, 300, 0.45, 'sine', 0.12],
          [0, 60, 60, 0.45, 'square', 0.06],
        ]);
        break;

      // X-Wing — Metralhadora Laser: bipes agudos e "digitais" bem
      // rápidos, mais eletrônico que o tambor mecânico do Bi-Mono.
      case 'special_xwing':
        beepSequence([
          [0, 2400, 2000, 0.04, 'sine', 0.09],
          [50, 2400, 2000, 0.04, 'sine', 0.09],
          [100, 2400, 2000, 0.04, 'sine', 0.09],
          [150, 2400, 2000, 0.04, 'sine', 0.09],
        ]);
        break;

      default:
        if (typeof name === 'string' && name.indexOf('special_') === 0) {
          // Avião novo ainda sem timbre próprio cadastrado acima — cai no
          // som genérico de sempre em vez de ficar mudo.
          beep(400, 1000, 0.3, 'sine', 0.1);
        }
        break;
    }
  } catch (e) { /* ignore */ }
}