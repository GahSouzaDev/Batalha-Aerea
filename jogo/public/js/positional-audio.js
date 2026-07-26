// ================================================================
//  SOM DO MOTOR — versão SEM THREE.PositionalAudio.
//  O PositionalAudio antigo recalculava o panner (posição/orientação
//  no PannerNode) a cada updateMatrixWorld(), e em certas situações
//  (sons que nunca carregam por causa dos 404, avião ainda sem
//  matriz mundial válida no primeiro frame, etc.) isso gerava um
//  valor não-finito passado pro AudioParam, travando o frame antes
//  do renderer.render() — daí a tela preta.
//
//  Aqui usamos THREE.Audio (sem PannerNode nenhum) e simulamos a
//  "posicionalidade" calculando o volume manualmente pela distância
//  câmera <-> avião, atualizado no mesmo lugar em que o volume por
//  velocidade já era atualizado (updateEngineSound). Zero chamadas
//  de linearRampToValueAtTime automáticas do Three.js.
//
//  CORRIGIDO — SOM DUPLICADO/MUITO ALTO:
//  Antes, cada attachEngineSound() registrava um listener isolado
//  (window 'click'/'keydown' {once:true}) fechado sobre aquele som
//  específico. Se você trocasse de avião (rebuildVehicle, respawn,
//  "jogar de novo" etc.) e o som antigo já tivesse sido parado
//  (stop()), mas o listener antigo ainda não tivesse disparado, o
//  primeiro clique/tecla seguinte chamava .play() nesse som MORTO de
//  novo — ressuscitando um motor "fantasma" tocando junto com o novo,
//  daí o som ficar dobrado e muito mais alto.
//
//  Agora existe UM ÚNICO listener global de "desbloqueio de áudio".
//  Em vez de cada som guardar sua própria referência numa closure
//  isolada, todo som pendente entra num registro (pendingEngineSounds)
//  vinculado ao objeto `parts` dele. Antes de tocar, sempre conferimos
//  se `parts.engineSound === sound` (ou seja, se esse som ainda é o
//  motor ATUAL daquele avião). Se o avião trocou de som nesse meio
//  tempo, o antigo nunca mais toca. detachEngineSound() também limpa
//  qualquer entrada pendente pra aquele som, então ele nunca pode ser
//  ressuscitado depois de removido.
//
//  CORREÇÃO ADICIONAL: Quando qualquer tela de menu/overlay está
//  visível (classe "overlay" sem "hidden"), o som do motor é
//  imediatamente zerado. Isso resolve o problema de ouvir o motor
//  enquanto se está no menu principal, pausa, lobby, etc.
// ================================================================
const audioLoaderShared = new THREE.AudioLoader(assetLoadingManager);
const engineSoundCache = new Map();

const ENGINE_REF_DISTANCE = 6;
const ENGINE_MAX_DISTANCE = 220;
const ENGINE_ROLLOFF = 1.8;

function loadEngineBuffer(fileName, cb) {
  if (engineSoundCache.has(fileName)) { cb(engineSoundCache.get(fileName)); return; }
  audioLoaderShared.load('sons/' + encodeURIComponent(fileName), (buffer) => {
    engineSoundCache.set(fileName, buffer);
    cb(buffer);
  }, undefined, () => { /* arquivo de som ausente - segue sem som */ });
}

// ===== Desbloqueio de áudio (política de autoplay do navegador) =====
// Um único listener global, em vez de um por som. Guarda pares
// {parts, sound} pendentes e, ao primeiro clique/tecla do usuário,
// tenta tocar cada um SÓ SE ele ainda for o som ativo daquele avião.
let audioUnlocked = false;
const pendingEngineSounds = new Set();

function unlockPendingEngineSounds() {
  audioUnlocked = true;
  pendingEngineSounds.forEach((entry) => {
    const { parts, sound } = entry;
    if (parts.engineSound === sound && !sound.isPlaying) {
      try { sound.play(); } catch (e) { /* ignore */ }
    }
  });
  pendingEngineSounds.clear();
}
window.addEventListener('click', unlockPendingEngineSounds, { once: true });
window.addEventListener('keydown', unlockPendingEngineSounds, { once: true });

// ===== Verifica se algum overlay (menu, pause, lobby, etc.) está visível =====
function isOverlayVisible() {
  // Qualquer elemento com classe "overlay" e que NÃO tenha a classe "hidden"
  // é considerado visível. Isso cobre menu principal, pause, lobby, fim de partida, etc.
  const overlays = document.querySelectorAll('.overlay:not(.hidden)');
  return overlays.length > 0;
}

// Anexa um som ao grupo do avião (funciona pra você e pra remotos).
// Não usa PositionalAudio: sem PannerNode, sem updateMatrixWorld customizado.
function attachEngineSound(parts, fileName, isLocal) {
  if (!parts || !parts.group || !fileName) return;
  const sound = new THREE.Audio(audioListener);
  sound.setLoop(true);
  sound.setVolume(0);
  // Adicionamos ao grupo só por conveniência de ciclo de vida (remoção
  // em cascata etc.) — THREE.Audio não usa a posição do pai pra nada.
  parts.group.add(sound);
  parts.engineSound = sound;
  parts.isLocalEngine = !!isLocal;

  loadEngineBuffer(fileName, (buffer) => {
    // Se o avião já trocou de som enquanto o buffer carregava, este
    // som não é mais o atual — não toca (evita motor fantasma).
    if (parts.engineSound !== sound) return;

    if (!sound.buffer) sound.setBuffer(buffer);

    if (audioUnlocked) {
      try { sound.play(); } catch (e) { /* ignore */ }
    } else {
      // Ainda não tivemos interação do usuário — entra na fila e
      // espera o desbloqueio global (um único listener pra tudo).
      pendingEngineSounds.add({ parts, sound });
    }
  });
}

const _engineWorldPos = new THREE.Vector3();

// Ajusta volume do som conforme aceleração do avião + distância manual até a câmera
function updateEngineSound(parts, speedRatio) {
  if (!parts || !parts.engineSound || !parts.engineSound.buffer) return;
  const s = parts.engineSound;

  // Se algum overlay estiver visível (menu, pause, lobby, etc.), o som deve ser ZERO.
  if (isOverlayVisible()) {
    s.setVolume(0);
    return;
  }

  // PEDIDO: opção "Sem som no jogo" (ui-menu.js) também zera o motor.
  if (typeof gameSoundMuted !== 'undefined' && gameSoundMuted) {
    s.setVolume(0);
    return;
  }

  // Volume base por velocidade
  const speedVol = 0.25 + Math.min(0.55, speedRatio * 0.55);

  let distanceGain = 1;
  if (!parts.isLocalEngine && parts.group && typeof camera !== 'undefined') {
    parts.group.getWorldPosition(_engineWorldPos);
    const dist = camera.position.distanceTo(_engineWorldPos);
    if (Number.isFinite(dist)) {
      if (dist >= ENGINE_MAX_DISTANCE) {
        distanceGain = 0;
      } else {
        // mesma curva do antigo setRefDistance/setRolloffFactor (inverse rolloff)
        const clampedDist = Math.max(dist, ENGINE_REF_DISTANCE);
        distanceGain = ENGINE_REF_DISTANCE /
          (ENGINE_REF_DISTANCE + ENGINE_ROLLOFF * (clampedDist - ENGINE_REF_DISTANCE));
      }
    } else {
      distanceGain = 0;
    }
  }

  // AJUSTADO: volumes-base reduzidos um pouco (0.35→0.28 / 0.5→0.42) e o
  // multiplicador final (2→1.6) — com a duplicação corrigida acima, isso
  // deixa o som geral mais equilibrado e menos "alto".
  const baseVolume = parts.isLocalEngine ? 0.28 : 0.42;
  let finalVolume = baseVolume * speedVol * 1.6 * distanceGain;
  if (!Number.isFinite(finalVolume)) finalVolume = 0;
  finalVolume = Math.max(0, Math.min(1, finalVolume));
  s.setVolume(finalVolume);

  if (s.setPlaybackRate) {
    let rate = 0.75 + Math.min(0.9, speedRatio * 0.9);
    if (!Number.isFinite(rate)) rate = 1;
    s.setPlaybackRate(rate);
  }
}

function detachEngineSound(parts) {
  if (parts && parts.engineSound) {
    const sound = parts.engineSound;
    try { sound.stop(); } catch (e) { /* ignore */ }
    sound.parent && sound.parent.remove(sound);
    parts.engineSound = null;

    // Remove qualquer entrada pendente que aponte pra este som — assim
    // ele nunca pode ser "ressuscitado" por um clique/tecla posterior.
    pendingEngineSounds.forEach((entry) => {
      if (entry.sound === sound) pendingEngineSounds.delete(entry);
    });
  }
}