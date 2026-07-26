// menu-camera.js
// ================================================================
//  CÂMERA LIVRE DO MENU/LOBBY — enquanto o menu principal ou o lobby
//  estiverem abertos, a câmera de voo normal (camera.js) é substituída
//  por uma câmera orbital 360° em volta do avião selecionado, que já
//  está sendo renderizado no fundo (rebuildVehicle roda ao trocar de
//  avião no menu). O jogador arrasta a tela pra girar livremente pra
//  qualquer lado e usa a roda do mouse pra dar zoom.
//
//  Além disso, o menu/lobby ficam "retráteis": um botão flutuante
//  recolhe o cartão pra uma faixa fina do lado, sem fechar a tela,
//  liberando o resto da tela pra ver o avião com nitidez.
// ================================================================

const menuOrbitCam = {
  theta: 0.55, targetTheta: 0.55,
  phi: 1.15, targetPhi: 1.15,
  radius: 6.5, targetRadius: 6.5,
};

let menuDragActive = false;
let menuDragLast = { x: 0, y: 0 };
let menuDragMoved = false;

function getActiveMenuOverlay() {
  const mm = document.getElementById('main-menu');
  const lb = document.getElementById('lobby-overlay');
  if (mm && !mm.classList.contains('hidden')) return mm;
  if (lb && !lb.classList.contains('hidden')) return lb;
  return null;
}

// Enquanto qualquer um dos dois estiver visível, a câmera de menu assume
// o controle no lugar da câmera de voo (ver main.js).
function isMenuPreviewActive() {
  return !!getActiveMenuOverlay();
}

function toggleMenuCollapse() {
  const overlay = getActiveMenuOverlay();
  if (!overlay) return;
  overlay.classList.toggle('overlay-collapsed');
  refreshMenuCollapseUI();
}

// CORREÇÃO: o botão flutuante único #menu-collapse-btn não existe mais —
// virou dois botões (o "🔭 VER AVIÃO" já embutido no cabeçalho do
// menu/lobby, que recolhe o cartão, e o "📋 VOLTAR AO MENU" flutuante,
// que só aparece com o cartão recolhido, pra trazer ele de volta).
// refreshMenuCollapseUI() agora só cuida de mostrar/esconder o botão de
// voltar e a dica de arrastar, conforme o estado recolhido ou não.
function refreshMenuCollapseUI() {
  const returnBtn = document.getElementById('menu-return-btn');
  const hint = document.getElementById('menu-cam-hint');
  const overlay = getActiveMenuOverlay();
  // PEDIDO: com o menu/lobby na tela, some com todo o HUD de voo (vida,
  // velocidade, placar, mira etc.) — só o avião girando de fundo. O CSS
  // que faz isso de verdade fica no index.html, aqui só ligamos/desligamos
  // a classe conforme a prévia do avião está ativa ou não.
  document.body.classList.toggle('menu-preview-active', !!overlay);
  if (!overlay) {
    // Nem menu nem lobby na tela (ex: em pleno combate) — nada disso
    // faz sentido aparecer.
    if (returnBtn) returnBtn.style.display = 'none';
    if (hint) hint.style.opacity = '0';
    return;
  }
  const collapsed = overlay.classList.contains('overlay-collapsed');
  // Só o avião visível (cartão recolhido) -> mostra o botão de voltar e
  // a dica de arrastar. Cartão aberto -> some com os dois (quem recolhe
  // já é o botão "VER AVIÃO" lá de dentro do cabeçalho).
  if (returnBtn) returnBtn.style.display = collapsed ? 'block' : 'none';
  if (hint) hint.style.opacity = collapsed ? '0.95' : '0';
}

document.addEventListener('DOMContentLoaded', () => {
  // Os três botões chamam o mesmo toggle: "VER AVIÃO" (menu e lobby)
  // recolhe o cartão, "VOLTAR AO MENU" desfaz.
  ['menu-view-plane-btn', 'lobby-view-plane-btn', 'menu-return-btn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', toggleMenuCollapse);
  });
  refreshMenuCollapseUI();
});

// Um clique/arraste dentro do cartão do menu (inputs, botões, grid de
// aviões etc.) nunca deve girar a câmera — só a área "vazia" da tela
// (que mostra o avião por trás) responde ao arraste.
function isMenuInteractiveTarget(el) {
  // CORREÇÃO: o chat de texto (#lobby-chat-box) e o painel de voz
  // (#voice-panel, com o botão de mic dentro) ficam fora do
  // .overlay-card de propósito (são elementos flutuantes globais, não
  // fazem parte do cartão do lobby). Sem essa exceção, esse listener
  // dava preventDefault() em QUALQUER clique fora do cartão — inclusive
  // no campo de digitar do chat — impedindo o input de ganhar foco.
  return !!(el && el.closest && el.closest('.overlay-card, .modal-content, .modal, #menu-collapse-btn, #lobby-chat-box, #voice-panel, #mc-mic'));
}

window.addEventListener('pointerdown', (e) => {
  if (!isMenuPreviewActive()) return;
  if (isMenuInteractiveTarget(e.target)) return;
  // Impede que o toque vire scroll/zoom da página no celular — a área
  // "vazia" atrás do menu deve responder só ao giro do avião.
  e.preventDefault();
  menuDragActive = true;
  menuDragMoved = false;
  menuDragLast.x = e.clientX;
  menuDragLast.y = e.clientY;
});

window.addEventListener('pointermove', (e) => {
  if (!menuDragActive) return;
  e.preventDefault();
  const dx = e.clientX - menuDragLast.x;
  const dy = e.clientY - menuDragLast.y;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) menuDragMoved = true;
  menuDragLast.x = e.clientX;
  menuDragLast.y = e.clientY;
  // Sem nenhum limite de ângulo — dá pra girar 100% pra qualquer lado.
  menuOrbitCam.targetTheta -= dx * 0.0065;
  menuOrbitCam.targetPhi = THREE.MathUtils.clamp(menuOrbitCam.targetPhi - dy * 0.0065, 0.12, Math.PI - 0.12);
}, { passive: false });

window.addEventListener('pointerup', () => { menuDragActive = false; });
window.addEventListener('pointercancel', () => { menuDragActive = false; });

window.addEventListener('wheel', (e) => {
  if (!isMenuPreviewActive()) return;
  if (isMenuInteractiveTarget(e.target)) return;
  menuOrbitCam.targetRadius = THREE.MathUtils.clamp(menuOrbitCam.targetRadius + e.deltaY * 0.01, 2.8, 18);
}, { passive: true });

function updateMenuPreviewCamera(dt) {
  const ease = Math.min(1, 6 * dt);
  menuOrbitCam.theta += (menuOrbitCam.targetTheta - menuOrbitCam.theta) * ease;
  menuOrbitCam.phi += (menuOrbitCam.targetPhi - menuOrbitCam.phi) * ease;
  menuOrbitCam.radius += (menuOrbitCam.targetRadius - menuOrbitCam.radius) * ease;

  const center = state.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const r = menuOrbitCam.radius;
  const sinPhi = Math.sin(menuOrbitCam.phi);
  const offset = new THREE.Vector3(
    r * sinPhi * Math.sin(menuOrbitCam.theta),
    r * Math.cos(menuOrbitCam.phi),
    r * sinPhi * Math.cos(menuOrbitCam.theta)
  );
  camera.position.copy(center).add(offset);
  camera.lookAt(center);
  camera.fov += (58 - camera.fov) * Math.min(1, 3 * dt);
  camera.updateProjectionMatrix();

  refreshMenuCollapseUI();
}