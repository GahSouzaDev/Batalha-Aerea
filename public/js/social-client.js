// social-client.js — perfil persistente, amigos e ranking
// ================================================================

async function socialOnLogin() {
    const guestNotice = document.getElementById('friends-guest-notice');
    const loggedArea = document.getElementById('friends-logged-area');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (loggedArea) loggedArea.classList.remove('hidden');

    const photoBlock = document.getElementById('profile-photo-block');
    if (photoBlock) photoBlock.classList.remove('hidden');

    try {
        const data = await authFetch('/api/profile/me');
        applyProfileToUI(data.profile);
        socialState.stats = data.stats;
    } catch (err) {
        console.warn('[social] não deu pra carregar o perfil:', err.message);
    }
}

const socialState = { stats: null, savingTimeout: null };

function applyProfileToUI(profile) {
    if (!profile) return;

    // Som
    if (typeof setGameSoundMuted === 'function' && typeof profile.soundEnabled === 'boolean') {
        setGameSoundMuted(!profile.soundEnabled);
    }

    // Música
    if (typeof setLobbyMusicEnabled === 'function' && typeof profile.musicEnabled === 'boolean') {
        setLobbyMusicEnabled(profile.musicEnabled);
    }

    // Avião preferido
    if (profile.preferredPlane && typeof PLANE_ORDER !== 'undefined' && typeof selectCarouselIndex === 'function') {
        const idx = PLANE_ORDER.indexOf(profile.preferredPlane);
        if (idx >= 0) selectCarouselIndex('menu', 'menu', idx);
    }

    // Foto disponível como opção (piloto 16), sem forçar seleção
    if (profile.photoUrl && typeof setCustomPilotPhoto === 'function') {
        setCustomPilotPhoto(profile.photoUrl, false);
    }

    // ============================================================
    //  PILOTO: usa EXATAMENTE o que está salvo na conta.
    //  - Se preferredPilot tem valor (ex: 5), seleciona 5.
    //  - Se preferredPilot é null (nunca salvou) E tem foto,
    //    seleciona 16 pela primeira vez e já salva 16.
    //  - Se preferredPilot é null e NÃO tem foto, não mexe
    //    (mantém o que o localStorage já tinha).
    // ============================================================
    if (typeof selectPilotIndex === 'function') {
        if (profile.preferredPilot != null) {
            // Já tem escolha salva na conta → usa ela, ponto final.
            selectPilotIndex(profile.preferredPilot);
        } else if (profile.photoUrl) {
            // Primeira vez: tem foto mas nunca escolheu → usa a foto
            // e salva pra próxima vez não precisar de fallback.
            selectPilotIndex(16);
        }
        // Se não tem preferredPilot nem foto → não faz nada,
        // o piloto que já estava no localStorage continua.
    }
}

// ================================================================
//  SALVAR CONFIGURAÇÕES NA CONTA
//  Acumula mudanças parciais e envia agrupadas (debounce).
// ================================================================
let _socialSaveDebounce = null;
let _socialSavePending = {};

function socialSaveSettings(partial) {
    if (typeof isLoggedIn !== 'function' || !isLoggedIn()) return;

    Object.assign(_socialSavePending, partial);

    clearTimeout(_socialSaveDebounce);
    _socialSaveDebounce = setTimeout(() => {
        const payload = { ..._socialSavePending };
        _socialSavePending = {};

        authFetch('/api/profile/settings', {
            method: 'POST',
            body: JSON.stringify(payload),
        }).catch(err => console.warn('[social] erro ao salvar configurações:', err.message));
    }, 400);
}

// ================================================================
//  FOTO DE PERFIL — upload
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('profile-photo-input');
    if (!input) return;

    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (!isLoggedIn()) { input.value = ''; return; }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await fetch('/api/profile/photo', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authState.token}` },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto.');

            // Foto nova → seleciona piloto 16 na hora e salva na conta
            if (typeof setCustomPilotPhoto === 'function') {
                setCustomPilotPhoto(data.photoUrl + '?t=' + Date.now(), true);
            }

            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('📷 Foto atualizada!', 1800);
        } catch (err) {
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + err.message, 2400);
            else alert(err.message);
        } finally {
            input.value = '';
        }
    });
});

// ================================================================
//  AMIGOS
// ================================================================
function socialEscapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function socialOpenFriendsModal() {
    const modal = document.getElementById('modal-friends');
    if (!modal) return;
    modal.classList.remove('hidden');

    const guestNotice = document.getElementById('friends-guest-notice');
    const loggedArea = document.getElementById('friends-logged-area');

    if (!isLoggedIn()) {
        if (guestNotice) guestNotice.classList.remove('hidden');
        if (loggedArea) loggedArea.classList.add('hidden');
        return;
    }

    if (guestNotice) guestNotice.classList.add('hidden');
    if (loggedArea) loggedArea.classList.remove('hidden');

    socialRefreshFriendsList();
}

function socialCloseFriendsModal() {
    const modal = document.getElementById('modal-friends');
    if (modal) modal.classList.add('hidden');
}

async function socialRefreshFriendsList() {
    try {
        const data = await authFetch('/api/friends');
        renderFriendRows('friends-incoming-list', data.incoming, 'incoming');
        renderFriendRows('friends-outgoing-list', data.outgoing, 'outgoing');
        renderFriendRows('friends-list', data.friends, 'friend');
    } catch (err) {
        console.warn('[social] erro ao carregar amigos:', err.message);
    }
}

function friendRowHtml(entry, kind) {
    const online = entry.online ? '<span style="color:#4cff8b;">● online</span>' : '<span style="color:#7a8a99;">○ offline</span>';
    let actions = '';

    if (kind === 'incoming') {
        actions = `<button class="btn-secondary btn-chip" data-action="accept" data-req="${entry.requestId}">✅ Aceitar</button> <button class="btn-secondary btn-chip" data-action="decline" data-req="${entry.requestId}">❌ Recusar</button>`;
    } else if (kind === 'outgoing') {
        actions = `<span style="font-size:11px;color:#7fbfd6;">Aguardando resposta...</span>`;
    } else if (kind === 'friend') {
        actions = `<button class="btn-secondary btn-chip" data-action="challenge" data-uid="${entry.userId}" data-nick="${socialEscapeHtml(entry.nickname)}" ${entry.online ? '' : 'disabled title="Offline"'}>⚔️ Desafiar</button> <button class="btn-secondary btn-chip" data-action="remove" data-uid="${entry.userId}">🗑️</button>`;
    }

    return `<div class="friend-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="text-align:left;">
            <div style="font-weight:600;">${socialEscapeHtml(entry.nickname)}</div>
            <div style="font-size:11px;">${online}</div>
        </div>
        <div style="display:flex;gap:6px;">${actions}</div>
    </div>`;
}

function renderFriendRows(containerId, list, kind) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!list || !list.length) {
        el.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Nada por aqui.</div>';
        return;
    }

    el.innerHTML = list.map(e => friendRowHtml(e, kind)).join('');
}

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'accept' || action === 'decline') {
        try {
            await authFetch('/api/friends/respond', { method: 'POST', body: JSON.stringify({ requestId: Number(btn.dataset.req), accept: action === 'accept' }) });
            socialRefreshFriendsList();
        } catch (err) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + err.message, 2200); }
    }

    if (action === 'remove') {
        try {
            await authFetch('/api/friends/remove', { method: 'POST', body: JSON.stringify({ userId: Number(btn.dataset.uid) }) });
            socialRefreshFriendsList();
        } catch (err) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + err.message, 2200); }
    }

    if (action === 'add-friend') {
        try {
            await authFetch('/api/friends/request', { method: 'POST', body: JSON.stringify({ nickname: btn.dataset.nick }) });
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('✅ Pedido enviado!', 1800);
            socialDoFriendSearch();
        } catch (err) { if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + err.message, 2200); }
    }

    if (action === 'challenge') {
        socialChallengeFriend(Number(btn.dataset.uid), btn.dataset.nick);
    }
});

async function socialDoFriendSearch() {
    const input = document.getElementById('friends-search-input');
    const results = document.getElementById('friends-search-results');
    if (!input || !results) return;

    const q = input.value.trim();
    if (q.length < 2) {
        results.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Digite pelo menos 2 letras.</div>';
        return;
    }

    try {
        const data = await authFetch('/api/friends/search?q=' + encodeURIComponent(q));
        if (!data.results.length) {
            results.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Ninguém encontrado.</div>';
            return;
        }

        results.innerHTML = data.results.map(u => {
            let action = `<button class="btn-secondary btn-chip" data-action="add-friend" data-nick="${socialEscapeHtml(u.nickname)}">➕ Adicionar</button>`;
            if (u.status === 'friends') action = '<span style="font-size:11px;color:#4cff8b;">Já são amigos</span>';
            else if (u.status === 'sent') action = '<span style="font-size:11px;color:#7fbfd6;">Pedido enviado</span>';
            else if (u.status === 'received') action = '<span style="font-size:11px;color:#ffd23f;">Te chamou — veja "Pedidos recebidos"</span>';

            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="font-weight:600;">${socialEscapeHtml(u.nickname)}</div>${action}
            </div>`;
        }).join('');
    } catch (err) {
        results.innerHTML = `<div style="font-size:12px;color:#ff8080;">${socialEscapeHtml(err.message)}</div>`;
    }
}

// ================================================================
//  DESAFIAR AMIGO
// ================================================================
function socialChallengeFriend(friendUserId, friendNickname) {
    if (!onlineState.socket || !onlineState.active) {
        if (typeof showTemporaryMessage === 'function') showTemporaryMessage('Crie uma sala primeiro (Criar Sala no menu) e desafie de dentro dela.', 3200);
        else alert('Crie uma sala primeiro e desafie de dentro dela.');
        return;
    }

    onlineState.socket.emit('challenge-friend', {
        friendUserId,
        roomId: onlineState.roomId,
        roomName: document.getElementById('menu-name') ? document.getElementById('menu-name').value : 'Sala',
        password: false,
    }, (res) => {
        if (!res || !res.success) {
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage('❌ ' + ((res && res.message) || 'Não foi possível desafiar.'), 2600);
        } else {
            if (typeof showTemporaryMessage === 'function') showTemporaryMessage(`⚔️ Convite enviado pra ${friendNickname}!`, 2200);
        }
    });
}

function socialOnFriendRequestReceived(data) {
    if (typeof showTemporaryMessage === 'function') showTemporaryMessage(`👥 ${data.fromNickname} quer ser seu amigo!`, 3000);
    socialRefreshFriendsList();
}

function socialOnFriendRequestAnswered(data) {
    const msg = data.accepted ? `✅ ${data.byNickname} aceitou seu pedido de amizade!` : `${data.byNickname} recusou seu pedido de amizade.`;
    if (typeof showTemporaryMessage === 'function') showTemporaryMessage(msg, 3000);
    socialRefreshFriendsList();
}

function socialOnChallengeInvite(data) {
    const accept = confirm(`⚔️ ${data.fromNickname} te desafiou pra uma partida! Aceitar e entrar na sala dele?`);

    if (onlineState.socket) {
        onlineState.socket.emit('challenge-response', { fromSocketId: data.fromSocketId, accept });
    }

    if (!accept) return;

    if (typeof leaveOnlineIfNeeded === 'function') leaveOnlineIfNeeded();

    document.getElementById('main-menu')?.classList.add('hidden');

    const playerData = {
        name: (document.getElementById('menu-name') || {}).value || 'Piloto',
        color: (document.getElementById('menu-color-custom') || {}).value || '#00e5ff',
        planeType: (typeof selectedPlaneType !== 'undefined') ? selectedPlaneType : 'cessna',
        useOriginalTexture: (document.getElementById('use-original-texture') || {}).checked,
        pilot: (typeof selectedPilotIndex !== 'undefined') ? selectedPilotIndex : 1,
    };

    const password = data.password ? (prompt('Senha da sala:') || '') : '';

    if (typeof connectOnline === 'function') {
        connectOnline(data.roomId, playerData, password);
    } else if (typeof showTemporaryMessage === 'function') {
        showTemporaryMessage('Abra "Entrar em Sala" e digite o código: ' + data.roomId, 4000);
    }
}

function socialOnChallengeResponse(data) {
    const msg = data.accepted ? `✅ ${data.byNickname} aceitou o desafio!` : `${data.byNickname} recusou o desafio.`;
    if (typeof showTemporaryMessage === 'function') showTemporaryMessage(msg, 2800);
}

// ================================================================
//  RANKING
// ================================================================
async function socialOpenRankingModal() {
    const modal = document.getElementById('modal-ranking');
    if (!modal) return;
    modal.classList.remove('hidden');

    const titlesEl = document.getElementById('ranking-titles');
    const boardEl = document.getElementById('ranking-leaderboard');

    if (titlesEl) titlesEl.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Carregando...</div>';
    if (boardEl) boardEl.innerHTML = '';

    try {
        const res = await fetch('/api/ranking');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar ranking.');

        const titleDefs = [
            { key: 'topKills', icon: '🎯', label: 'Maior Abatedor' },
            { key: 'topBlimps', icon: '🎈', label: 'Maior Abatedor de Balões' },
            { key: 'topPlaytime', icon: '⏱️', label: 'Mais Horas Voadas' },
        ];

        if (titlesEl) {
            titlesEl.innerHTML = titleDefs.map(t => {
                const row = data.titles && data.titles[t.key];
                if (!row) return `<div style="font-size:12px;color:#7a8a99;padding:4px 0;">${t.icon} ${t.label}: ninguém ainda</div>`;
                const valueText = t.key === 'topPlaytime' ? Math.round(row.value / 60) + ' min' : row.value;
                return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">${t.icon} <b>${t.label}</b>: <span style="color:#4cff8b;">${socialEscapeHtml(row.nickname)}</span> (${valueText})</div>`;
            }).join('');
        }

        if (boardEl) {
            if (!data.leaderboard.length) {
                boardEl.innerHTML = '<div style="font-size:12px;color:#7a8a99;">Ninguém jogou logado ainda.</div>';
            } else {
                boardEl.innerHTML = data.leaderboard.map((p, i) => `
                    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;">
                        <span>#${i + 1} ${socialEscapeHtml(p.nickname)}</span>
                        <span>⚔${p.kills} 💀${p.deaths} 🎈${p.blimp_kills}</span>
                    </div>`).join('');
            }
        }
    } catch (err) {
        if (titlesEl) titlesEl.innerHTML = `<div style="font-size:12px;color:#ff8080;">${socialEscapeHtml(err.message)}</div>`;
    }
}

// ================================================================
//  INICIALIZAÇÃO — botões/modais
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnFriends = document.getElementById('btn-friends');
    const lobbyBtnFriends = document.getElementById('lobby-btn-friends');
    const btnRanking = document.getElementById('btn-ranking');
    const closeFriends = document.getElementById('modal-friends-close');
    const closeRanking = document.getElementById('modal-ranking-close');
    const searchBtn = document.getElementById('friends-search-btn');
    const searchInput = document.getElementById('friends-search-input');

    if (btnFriends) btnFriends.addEventListener('click', socialOpenFriendsModal);
    if (lobbyBtnFriends) lobbyBtnFriends.addEventListener('click', socialOpenFriendsModal);
    if (btnRanking) btnRanking.addEventListener('click', socialOpenRankingModal);
    if (closeFriends) closeFriends.addEventListener('click', socialCloseFriendsModal);
    if (closeRanking) closeRanking.addEventListener('click', () => document.getElementById('modal-ranking').classList.add('hidden'));
    if (searchBtn) searchBtn.addEventListener('click', socialDoFriendSearch);
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') socialDoFriendSearch(); });
});