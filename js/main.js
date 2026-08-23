import { GameState } from './engine/GameState.js?v=8.2';
import { UIRenderer } from './ui/UIRenderer.js?v=8.2';

const game = new GameState();
const ui = new UIRenderer(game);
window.gameUI = ui;

// ==========================================
// SOCKET CONNECTION SETUP
// ==========================================
let serverUrl = 'https://gem-merchant-1.onrender.com';
if (window.location.protocol.startsWith('http')) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = 'http://localhost:3000';
    } else {
        serverUrl = window.location.origin;
    }
}
const socket = io(serverUrl);

socket.on('connect', () => {
    console.log("Connected to Gem Merchant multiplayer server:", socket.id);
    
    // Auto-reconnect if session exists
    const savedSession = sessionStorage.getItem('gem_merchant_session');
    if (savedSession) {
        try {
            const { roomCode, playerName } = JSON.parse(savedSession);
            if (roomCode && playerName) {
                console.log(`Auto-reconnecting to room ${roomCode} as ${playerName}`);
                currentRoomCode = roomCode;
                myPlayerName = playerName;
                ui.localPlayerName = playerName;
                ui.currentRoomCode = roomCode;
                socket.emit('join_room', { roomCode, playerName });
            }
        } catch (e) {
            sessionStorage.removeItem('gem_merchant_session');
        }
    }
});

socket.on('connect_error', (err) => {
    console.warn("Multiplayer socket connection error:", err.message);
});

// Game & Lobby State
let selectedTokens = [];
let chosenPlayerCount = 2;
let currentRoomCode = null;
let myPlayerName = 'You';
let currentGameMode = 'solo'; // 'solo' | 'pass_and_play' | 'online'
let currentRoomPlayers = [];
let sfxEnabled = true;

// Audio Helpers
const sfxPurchase = new Audio('malaysian_cuisine_cards/Apple%20pay%20sucesssound%20track.mp3'); 
const sfxReserve = new Audio('malaysian_cuisine_cards/token.mp3');  
const sfxToken = new Audio('malaysian_cuisine_cards/token.mp3');    
const bgMusic = new Audio('malaysian_cuisine_cards/Rasa%20Sayang%20-%20Saykoji%20(%20Remix%20)%20%20TikTok%20Version.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.35;
let isMusicPlaying = false;

function playSound(sound, playbackRate = 1.0) {
    if (sfxEnabled && sound) {
        sound.currentTime = 0;
        sound.playbackRate = playbackRate;
        sound.play().catch(e => console.log("Audio play error:", e));
    }
}

function canLocalPlayerAct() {
    if (game.isGameOver) return false;
    if (currentGameMode === 'solo') {
        return game.currentPlayerIndex === 0;
    }
    if (currentGameMode === 'pass_and_play') {
        return true;
    }
    if (currentGameMode === 'online') {
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer) return false;
        return currentPlayer.name.trim().toLowerCase() === myPlayerName.trim().toLowerCase();
    }
    return true;
}

function copyRoomCodeToClipboard() {
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode).then(() => {
        ui.showToast(`📋 Room Code <b>${currentRoomCode.toUpperCase()}</b> copied to clipboard!`);
    }).catch(() => {
        prompt("Copy this Room Code:", currentRoomCode);
    });
}

// ==========================================
// SOCKET SYNC LISTENERS FOR MULTIPLAYER
// ==========================================
socket.on('update_room', (roomData) => {
    console.log("Room players updated:", roomData.players);
    currentRoomPlayers = roomData.players || [];
    currentRoomCode = roomData.roomCode || currentRoomCode;
    ui.currentRoomCode = currentRoomCode;

    // Update online statuses inside active game players
    if (game.players && game.players.length > 0) {
        game.players.forEach(gp => {
            const match = currentRoomPlayers.find(rp => rp.name.toLowerCase() === gp.name.toLowerCase());
            if (match) gp.online = match.online;
        });
        ui.renderAll();
    }
    
    // Update Lobby UI
    const roomCodeDisplay = document.getElementById('lobby-display-room-code');
    if (roomCodeDisplay) roomCodeDisplay.innerText = currentRoomCode.toUpperCase();

    const countDisplay = document.getElementById('lobby-player-count');
    if (countDisplay) countDisplay.innerText = `${currentRoomPlayers.length}/4`;

    const playerListEl = document.getElementById('lobby-player-list');
    if (playerListEl) {
        playerListEl.innerHTML = currentRoomPlayers.map(p => {
            const isMe = p.name.toLowerCase() === myPlayerName.toLowerCase();
            const isHost = p.isHost;
            const isOnline = p.online !== false;
            return `
                <li style="padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid ${isMe ? '#2ecc71' : '#5a4b31'}; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: ${isMe ? '#2ecc71' : 'var(--text-gold)'}; display: flex; align-items: center; gap: 6px;">
                        <span class="${isOnline ? 'online-dot' : 'offline-dot'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
                        ${p.name} ${isMe ? '(You)' : ''}
                    </span>
                    <span style="font-size: 0.75em; color: ${isHost ? 'var(--gold)' : 'var(--text-muted)'}; text-transform: uppercase; font-weight: bold;">
                        ${isHost ? '👑 Host' : (isOnline ? 'Merchant' : 'Offline')}
                    </span>
                </li>
            `;
        }).join('');
    }

    const hostControls = document.getElementById('lobby-host-controls');
    const guestMsg = document.getElementById('lobby-guest-msg');
    const startBtn = document.getElementById('lobby-start-game-btn');

    const amIHost = currentRoomPlayers.some(p => p.id === socket.id && p.isHost);
    if (amIHost) {
        if (hostControls) hostControls.style.display = 'flex';
        if (guestMsg) guestMsg.style.display = 'none';
        if (startBtn) {
            startBtn.disabled = currentRoomPlayers.length < 2;
            startBtn.style.opacity = currentRoomPlayers.length < 2 ? '0.5' : '1.0';
            startBtn.style.cursor = currentRoomPlayers.length < 2 ? 'not-allowed' : 'pointer';
        }
    } else {
        if (hostControls) hostControls.style.display = 'none';
        if (guestMsg) guestMsg.style.display = 'block';
    }
});

socket.on('player_status_changed', ({ playerName, online }) => {
    const isMe = playerName.toLowerCase() === myPlayerName.toLowerCase();
    if (!isMe) {
        if (online) {
            ui.showToast(`🟢 <b>${playerName}</b> has reconnected to the room!`);
        } else {
            ui.showToast(`⚪ <b>${playerName}</b> is currently offline / disconnected.`);
        }
    }
});

// Game Started from Host (First Time)
socket.on('game_started', (initialState) => {
    console.log("Game started with initial synchronized state:", initialState);
    
    document.getElementById('mode-select-overlay').style.display = 'none';
    document.getElementById('online-lobby-overlay').style.display = 'none';

    currentGameMode = 'online';
    ui.gameMode = 'online';
    ui.localPlayerName = myPlayerName;
    ui.currentRoomCode = currentRoomCode;

    game.loadInitialState(initialState);
    ui.renderAll();
    ui.showToast(`🚀 The game has begun! Good luck merchants!`);
});

// Reconnection Live State Sync (Resumes game right where it left off)
socket.on('sync_live_state', ({ liveState, reconnect }) => {
    console.log("Syncing live game state on reconnection:", liveState);
    
    document.getElementById('mode-select-overlay').style.display = 'none';
    document.getElementById('online-lobby-overlay').style.display = 'none';

    currentGameMode = 'online';
    ui.gameMode = 'online';
    ui.localPlayerName = myPlayerName;
    ui.currentRoomCode = currentRoomCode;

    game.loadCurrentState(liveState);
    ui.renderAll();
    ui.showToast(`✅ Successfully reconnected to match in Room <b>${currentRoomCode.toUpperCase()}</b>!`);
});

// Sync Turn Actions across connected clients
socket.on('sync_game_state', ({ actionData, fullState }) => {
    console.log("Received action sync:", actionData);
    try {
        if (fullState) {
            game.loadCurrentState(fullState);
        } else if (actionData) {
            if (actionData.type === 'TAKE_DIFFERENT') {
                game.takeDifferentResources(actionData.tokens);
            } else if (actionData.type === 'TAKE_TWO') {
                game.takeTwoResources(actionData.resource);
            } else if (actionData.type === 'BUY_CARD') {
                game.purchaseVisibleCard(actionData.tier, actionData.cardId);
            } else if (actionData.type === 'RESERVE_CARD') {
                game.reserveVisibleCard(actionData.tier, actionData.cardId);
            } else if (actionData.type === 'BUY_RESERVED') {
                game.purchaseReservedCard(actionData.cardId);
            } else if (actionData.type === 'DISCARD_TOKENS') {
                game.discardTokens(actionData.tokens);
            } else if (actionData.type === 'CANCEL_TOKEN_ACTION') {
                game.cancelLastTokenAction();
                ui.hideDiscardModal();
            }
        }

        // Action audio & toasts
        if (actionData) {
            if (actionData.type === 'TAKE_DIFFERENT' || actionData.type === 'TAKE_TWO') {
                playSound(sfxToken, 1.6);
            } else if (actionData.type === 'BUY_CARD' || actionData.type === 'BUY_RESERVED') {
                playSound(sfxPurchase, 1.5);
                ui.showToast(`✦ A development card was acquired!`);
            } else if (actionData.type === 'RESERVE_CARD') {
                playSound(sfxReserve, 1.2);
                ui.showToast(`✦ A development card was reserved.`);
            }
        }
    } catch (err) {
        console.error("Error executing synced action:", err);
        if (fullState) game.loadCurrentState(fullState);
    }
    ui.renderAll();
});

// Initialize default mobile tab
document.body.classList.add('tab-market');

// ==========================================
// EVENT LISTENERS & UI INTERACTION
// ==========================================
document.addEventListener('click', (e) => {
    // Mobile Tab Switcher Handler
    if (e.target.classList.contains('mobile-tab-btn')) {
        const tab = e.target.dataset.tab;
        if (tab) {
            document.querySelectorAll('.mobile-tab-btn').forEach(btn => btn.classList.remove('active-tab'));
            e.target.classList.add('active-tab');
            document.body.classList.remove('tab-market', 'tab-bank', 'tab-players');
            document.body.classList.add(`tab-${tab}`);
        }
        return;
    }

    // Music Toggle Button Handler
    if (e.target.id === 'music-toggle-btn') {
        const btn = e.target;
        if (isMusicPlaying) {
            bgMusic.pause();
            isMusicPlaying = false;
            btn.textContent = '🔇 Music: OFF';
        } else {
            bgMusic.play().then(() => {
                isMusicPlaying = true;
                btn.textContent = '🔊 Music: ON';
            }).catch(err => console.log("Music play blocked:", err));
        }
        return;
    }

    // SFX Toggle Button
    if (e.target.id === 'sfx-toggle-btn') {
        sfxEnabled = !sfxEnabled;
        e.target.textContent = sfxEnabled ? '🔔 SFX: ON' : '🔕 SFX: OFF';
        return;
    }

    // Copy Room Code click handlers
    if (e.target.id === 'lobby-copy-code-btn' || e.target.closest('#in-game-room-badge')) {
        copyRoomCodeToClipboard();
        return;
    }

    // Rules Modal Handlers
    if (e.target.id === 'nav-rules-btn' || e.target.id === 'open-rules-menu-btn') {
        document.getElementById('rules-modal').style.display = 'flex';
        return;
    }
    if (e.target.id === 'close-rules-btn' || e.target.id === 'close-rules-bottom-btn' || e.target.id === 'rules-modal') {
        document.getElementById('rules-modal').style.display = 'none';
        return;
    }

    // Leave Game Button Handler
    if (e.target.id === 'leave-game-btn') {
        if (confirm("Are you sure you want to leave the current match?")) {
            sessionStorage.removeItem('gem_merchant_session');
            window.location.reload();
        }
        return;
    }

    // Player Count Button Selector (for Solo and Pass & Play)
    if (e.target.classList.contains('player-count-btn')) {
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.className = 'player-count-btn res-btn';
            btn.style.background = 'linear-gradient(to bottom, #5a4b31, #3a2f1e)';
            btn.style.color = 'var(--text-gold)';
        });
        e.target.className = 'player-count-btn buy-btn';
        e.target.style.background = '#f1c40f';
        e.target.style.color = '#1a0f00';
        chosenPlayerCount = parseInt(e.target.dataset.count);
        return;
    }

    // Solo Mode Button Handler
    if (e.target.id === 'mode-solo-btn') {
        document.getElementById('mode-select-overlay').style.display = 'none';
        
        currentGameMode = 'solo';
        myPlayerName = 'You';
        ui.gameMode = 'solo';
        ui.localPlayerName = 'You';
        ui.currentRoomCode = null;

        const names = ['You'];
        for (let i = 1; i < chosenPlayerCount; i++) {
            names.push(`Bot ${i}`);
        }
        game.initializeGame(names, true);
        ui.renderAll();
        ui.showToast("🤖 Solo game started against AI Bots. Your turn!");
        return;
    }

    // Pass & Play Mode Button Handler
    if (e.target.id === 'mode-multi-btn') {
        document.getElementById('mode-select-overlay').style.display = 'none';
        
        currentGameMode = 'pass_and_play';
        myPlayerName = 'Merchant 1';
        ui.gameMode = 'pass_and_play';
        ui.localPlayerName = 'Merchant 1';
        ui.currentRoomCode = null;

        const names = [];
        for (let i = 1; i <= chosenPlayerCount; i++) {
            names.push(`Merchant ${i}`);
        }
        game.initializeGame(names, false);
        ui.renderAll();
        ui.showToast("👥 Pass & Play game started! Pass the screen on each turn.");
        return;
    }

    // Open Online Lobby Button Handler
    if (e.target.id === 'join-online-room-btn') {
        document.getElementById('mode-select-overlay').style.display = 'none';
        document.getElementById('online-lobby-overlay').style.display = 'flex';

        document.getElementById('lobby-join-form').style.display = 'flex';
        document.getElementById('lobby-room-view').style.display = 'none';
        return;
    }

    // Lobby Join/Create Room Button Handler
    if (e.target.id === 'lobby-join-btn') {
        const roomCodeInput = document.getElementById('room-code-input');
        const playerNameInput = document.getElementById('player-name-input');

        const roomCode = roomCodeInput ? roomCodeInput.value.trim().toLowerCase() : '';
        const playerName = playerNameInput ? playerNameInput.value.trim() : '';

        if (!roomCode) {
            alert("Please enter a Room Code.");
            return;
        }
        if (!playerName) {
            alert("Please enter your Merchant Name.");
            return;
        }

        currentRoomCode = roomCode;
        myPlayerName = playerName;
        ui.localPlayerName = playerName;
        ui.currentRoomCode = roomCode;

        // Persist session for reconnection
        sessionStorage.setItem('gem_merchant_session', JSON.stringify({ roomCode, playerName }));

        socket.emit('join_room', { roomCode: currentRoomCode, playerName: myPlayerName });

        document.getElementById('lobby-join-form').style.display = 'none';
        document.getElementById('lobby-room-view').style.display = 'flex';
        return;
    }

    // Lobby Back to Main Menu Button
    if (e.target.id === 'lobby-back-to-mode-btn') {
        document.getElementById('online-lobby-overlay').style.display = 'none';
        document.getElementById('mode-select-overlay').style.display = 'flex';
        return;
    }

    // Lobby Leave Room Button
    if (e.target.id === 'lobby-leave-room-btn') {
        sessionStorage.removeItem('gem_merchant_session');
        window.location.reload();
        return;
    }

    // Host Starts Online Game
    if (e.target.id === 'lobby-start-game-btn') {
        if (currentRoomPlayers.length < 2) {
            alert("You need at least 2 players in the room to start.");
            return;
        }

        const playerNames = currentRoomPlayers.map(p => p.name);
        game.initializeGame(playerNames, false);
        const initialState = game.serializeInitialState();

        socket.emit('start_game', { roomCode: currentRoomCode, initialState });
        return;
    }

    // Token Selection in Bank
    if (e.target.classList.contains('bank-token')) {
        if (!canLocalPlayerAct()) {
            ui.showToast("⏳ Please wait for your turn!");
            return;
        }

        const resource = e.target.dataset.resource;
        if (resource === 'gold') return;

        const countInSelection = selectedTokens.filter(r => r === resource).length;

        if (countInSelection > 0) {
            const uniqueTypes = new Set(selectedTokens);
            if (uniqueTypes.size === 1 && selectedTokens.length === 1) {
                const bankCount = game.bank.tokens[resource] || 0;
                if (bankCount >= 4) {
                    selectedTokens.push(resource);
                } else {
                    alert(`To take 2 tokens of the same color, the bank must have at least 4 available.`);
                }
            } else {
                selectedTokens = selectedTokens.filter(r => r !== resource);
            }
        } else {
            if (selectedTokens.length < 3) {
                selectedTokens.push(resource);
            }
        }
        ui.updatePendingTokensDisplay(selectedTokens);
    }

    // Confirm Tokens Action
    if (e.target.id === 'confirm-tokens-btn') {
        if (!canLocalPlayerAct()) {
            ui.showToast("⏳ Please wait for your turn!");
            return;
        }

        try {
            if (selectedTokens.length === 0) return;
            const unique = new Set(selectedTokens);
            let actionData = null;

            if (unique.size === selectedTokens.length) {
                game.takeDifferentResources(selectedTokens);
                actionData = { type: 'TAKE_DIFFERENT', tokens: selectedTokens };
            } else if (selectedTokens.length === 2 && selectedTokens[0] === selectedTokens[1]) {
                const res = selectedTokens[0];
                game.takeTwoResources(res);
                actionData = { type: 'TAKE_TWO', resource: res };
            }
            playSound(sfxToken, 1.6);

            if (currentGameMode === 'online' && currentRoomCode && actionData) {
                socket.emit('game_action', {
                    roomCode: currentRoomCode,
                    actionData,
                    fullState: game.serializeCurrentState()
                });
            }

            selectedTokens = [];
            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    if (e.target.id === 'clear-tokens-btn') {
        selectedTokens = [];
        ui.updatePendingTokensDisplay([]);
    }

    // Purchase Visible Card
    if (e.target.classList.contains('buy-btn') && e.target.dataset.tier && e.target.dataset.id) {
        if (!canLocalPlayerAct()) {
            ui.showToast("⏳ Please wait for your turn!");
            return;
        }

        const tier = parseInt(e.target.dataset.tier);
        const cardId = e.target.dataset.id;
        try {
            game.purchaseVisibleCard(tier, cardId);
            playSound(sfxPurchase, 1.5);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', {
                    roomCode: currentRoomCode,
                    actionData: { type: 'BUY_CARD', tier, cardId },
                    fullState: game.serializeCurrentState()
                });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Reserve Visible Card
    if (e.target.classList.contains('res-btn') && e.target.dataset.tier && e.target.dataset.id) {
        if (!canLocalPlayerAct()) {
            ui.showToast("⏳ Please wait for your turn!");
            return;
        }

        const tier = parseInt(e.target.dataset.tier);
        const cardId = e.target.dataset.id;
        try {
            game.reserveVisibleCard(tier, cardId);
            playSound(sfxReserve, 1.2);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', {
                    roomCode: currentRoomCode,
                    actionData: { type: 'RESERVE_CARD', tier, cardId },
                    fullState: game.serializeCurrentState()
                });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Purchase Reserved Card
    if (e.target.classList.contains('buy-res-btn') && e.target.dataset.id) {
        if (!canLocalPlayerAct()) {
            ui.showToast("⏳ Please wait for your turn!");
            return;
        }

        const cardId = e.target.dataset.id;
        try {
            game.purchaseReservedCard(cardId);
            playSound(sfxPurchase, 1.5);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', {
                    roomCode: currentRoomCode,
                    actionData: { type: 'BUY_RESERVED', cardId },
                    fullState: game.serializeCurrentState()
                });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Cancel Discard and Take Fewer Tokens Button
    if (e.target.id === 'cancel-discard-btn') {
        if (!canLocalPlayerAct()) return;

        game.cancelLastTokenAction();
        selectedTokens = [];
        ui.updatePendingTokensDisplay([]);
        ui.hideDiscardModal();

        if (currentGameMode === 'online' && currentRoomCode) {
            socket.emit('game_action', {
                roomCode: currentRoomCode,
                actionData: { type: 'CANCEL_TOKEN_ACTION' },
                fullState: game.serializeCurrentState()
            });
        }

        ui.showToast("↩️ Token action rolled back! You can now select fewer tokens or buy a card.");
        ui.renderAll();
        return;
    }

    // Discard Tokens Confirmation Button
    if (e.target.id === 'confirm-discard-btn') {
        if (!canLocalPlayerAct()) return;

        try {
            let tokensToDiscard = ui.getPendingDiscardTokens ? ui.getPendingDiscardTokens() : [];
            if (!tokensToDiscard || tokensToDiscard.length === 0) {
                const selects = document.querySelectorAll('.discard-select');
                if (selects.length > 0) {
                    tokensToDiscard = Array.from(selects).map(s => s.value);
                }
            }

            game.discardTokens(tokensToDiscard);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', {
                    roomCode: currentRoomCode,
                    actionData: { type: 'DISCARD_TOKENS', tokens: tokensToDiscard },
                    fullState: game.serializeCurrentState()
                });
            }

            ui.hideDiscardModal();
            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }
});

// Preload all 45 original card photos and 5 patron portraits in background for instant rendering
function preloadGameAssets() {
    for (let i = 1; i <= 45; i++) {
        const img = new Image();
        img.src = `malaysian_cuisine_cards/card_t1_${i}.png`;
    }
    for (let i = 1; i <= 5; i++) {
        const pImg = new Image();
        pImg.src = `malaysian_cuisine_cards/patron_${i}.jpg`;
    }
}

if (document.readyState === 'complete') {
    preloadGameAssets();
} else {
    window.addEventListener('load', preloadGameAssets);
}