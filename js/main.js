import { GameState } from './engine/GameState.js';
import { UIRenderer } from './ui/UIRenderer.js';

const game = new GameState();
const ui = new UIRenderer(game);
window.gameUI = ui;

// ==========================================
// SOCKET CONNECTION SETUP
// ==========================================
// Auto-detect server URL: localhost for local dev, Render for remote production
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
});

socket.on('connect_error', (err) => {
    console.warn("Multiplayer socket connection error:", err.message);
});

// Game & Lobby State
let selectedTokens = [];
let chosenPlayerCount = 2; // Default to 2 players
let currentRoomCode = null;
let myPlayerName = 'You';
let currentGameMode = 'solo'; // 'solo' | 'pass_and_play' | 'online'
let currentRoomPlayers = [];

// Audio Helpers
const sfxPurchase = new Audio('malaysian_cuisine_cards/Apple%20pay%20sucesssound%20track.mp3'); 
const sfxReserve = new Audio('malaysian_cuisine_cards/token.mp3');  
const sfxToken = new Audio('malaysian_cuisine_cards/token.mp3');    
const bgMusic = new Audio('malaysian_cuisine_cards/Rasa%20Sayang%20-%20Saykoji%20(%20Remix%20)%20%20TikTok%20Version.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.35;
let isMusicPlaying = false;

function playSound(sound, playbackRate = 1.0) {
    if (sound) {
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

// ==========================================
// SOCKET SYNC LISTENERS FOR MULTIPLAYER
// ==========================================
socket.on('update_room', (roomData) => {
    console.log("Room players updated:", roomData.players);
    currentRoomPlayers = roomData.players || [];
    
    // Update Lobby UI
    const roomCodeDisplay = document.getElementById('lobby-display-room-code');
    if (roomCodeDisplay) roomCodeDisplay.innerText = roomData.roomCode || currentRoomCode;

    const countDisplay = document.getElementById('lobby-player-count');
    if (countDisplay) countDisplay.innerText = `${currentRoomPlayers.length}/4`;

    const playerListEl = document.getElementById('lobby-player-list');
    if (playerListEl) {
        playerListEl.innerHTML = currentRoomPlayers.map(p => {
            const isMe = p.id === socket.id;
            const isHost = p.isHost;
            return `
                <li style="padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid ${isMe ? '#2ecc71' : '#5a4b31'}; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: ${isMe ? '#2ecc71' : '#e6d3a8'};">${p.name} ${isMe ? '(You)' : ''}</span>
                    <span style="font-size: 0.75em; color: ${isHost ? '#f1c40f' : '#a38d59'}; text-transform: uppercase;">${isHost ? '👑 Host' : 'Player'}</span>
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

// Game Started from Host (All clients load the identical synchronized deck and market)
socket.on('game_started', (initialState) => {
    console.log("Game started with synchronized initial state:", initialState);
    
    // Hide all menu overlays
    const modeOverlay = document.getElementById('mode-select-overlay');
    if (modeOverlay) modeOverlay.style.display = 'none';
    const lobbyOverlay = document.getElementById('online-lobby-overlay');
    if (lobbyOverlay) lobbyOverlay.style.display = 'none';

    currentGameMode = 'online';
    ui.gameMode = 'online';
    ui.localPlayerName = myPlayerName;

    game.loadInitialState(initialState);
    ui.renderAll();
});

// Sync Turn Actions across connected clients
socket.on('sync_game_state', (actionData) => {
    console.log("Received action sync:", actionData);
    try {
        if (actionData.type === 'TAKE_DIFFERENT') {
            game.takeDifferentResources(actionData.tokens);
            playSound(sfxToken, 1.6);
        } else if (actionData.type === 'TAKE_TWO') {
            game.takeTwoResources(actionData.resource);
            playSound(sfxToken, 1.6);
        } else if (actionData.type === 'BUY_CARD') {
            game.purchaseVisibleCard(actionData.tier, actionData.cardId);
            playSound(sfxPurchase, 1.5);
        } else if (actionData.type === 'RESERVE_CARD') {
            game.reserveVisibleCard(actionData.tier, actionData.cardId);
            playSound(sfxReserve, 1.2);
        } else if (actionData.type === 'BUY_RESERVED') {
            game.purchaseReservedCard(actionData.cardId);
            playSound(sfxPurchase, 1.5);
        } else if (actionData.type === 'DISCARD_TOKENS') {
            game.discardTokens(actionData.tokens);
        }
    } catch (err) {
        console.error("Error executing synced action:", err);
    }
    ui.renderAll();
});

// ==========================================
// EVENT LISTENERS & UI INTERACTION
// ==========================================
document.addEventListener('click', (e) => {
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

    // Player Count Button Selector (for Solo and Pass & Play)
    if (e.target.classList.contains('player-count-btn')) {
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.style.background = 'linear-gradient(to bottom, #ebd197, #c49c47)';
            btn.style.color = '#1a0f00';
        });
        e.target.style.background = '#f1c40f';
        e.target.style.color = '#1a0f00';
        chosenPlayerCount = parseInt(e.target.dataset.count);
        return;
    }

    // Solo Mode Button Handler
    if (e.target.id === 'mode-solo-btn') {
        const overlay = document.getElementById('mode-select-overlay');
        if (overlay) overlay.style.display = 'none';
        
        currentGameMode = 'solo';
        myPlayerName = 'You';
        ui.gameMode = 'solo';
        ui.localPlayerName = 'You';

        const names = ['You'];
        for (let i = 1; i < chosenPlayerCount; i++) {
            names.push(`Bot ${i}`);
        }
        game.initializeGame(names, true); // true = Vs AI mode
        ui.renderAll();
        return;
    }

    // Pass & Play Mode Button Handler
    if (e.target.id === 'mode-multi-btn') {
        const overlay = document.getElementById('mode-select-overlay');
        if (overlay) overlay.style.display = 'none';
        
        currentGameMode = 'pass_and_play';
        myPlayerName = 'Player 1';
        ui.gameMode = 'pass_and_play';
        ui.localPlayerName = 'Player 1';

        const names = [];
        const possibleNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
        for (let i = 0; i < chosenPlayerCount; i++) {
            names.push(possibleNames[i]);
        }
        game.initializeGame(names, false);
        ui.renderAll();
        return;
    }

    // Open Online Lobby Button Handler
    if (e.target.id === 'join-online-room-btn') {
        const modeOverlay = document.getElementById('mode-select-overlay');
        if (modeOverlay) modeOverlay.style.display = 'none';
        
        const lobbyOverlay = document.getElementById('online-lobby-overlay');
        if (lobbyOverlay) lobbyOverlay.style.display = 'flex';

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
            alert("Please enter your Chef Name.");
            return;
        }

        currentRoomCode = roomCode;
        myPlayerName = playerName;
        ui.localPlayerName = playerName;

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
            alert("Please wait for your turn!");
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
                    alert(`To take 2 of the same token, the bank must have at least 4 available.`);
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
            alert("Please wait for your turn!");
            return;
        }

        try {
            if (selectedTokens.length === 0) return;
            const unique = new Set(selectedTokens);

            if (unique.size === selectedTokens.length) {
                game.takeDifferentResources(selectedTokens);
                if (currentGameMode === 'online' && currentRoomCode) {
                    socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'TAKE_DIFFERENT', tokens: selectedTokens } });
                }
            } else if (selectedTokens.length === 2 && selectedTokens[0] === selectedTokens[1]) {
                const res = selectedTokens[0];
                game.takeTwoResources(res);
                if (currentGameMode === 'online' && currentRoomCode) {
                    socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'TAKE_TWO', resource: res } });
                }
            }
            playSound(sfxToken, 1.6);

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
            alert("Please wait for your turn!");
            return;
        }

        const tier = parseInt(e.target.dataset.tier);
        const cardId = e.target.dataset.id;
        try {
            game.purchaseVisibleCard(tier, cardId);
            playSound(sfxPurchase, 1.5);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'BUY_CARD', tier, cardId } });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Reserve Visible Card
    if (e.target.classList.contains('res-btn') && e.target.dataset.tier && e.target.dataset.id) {
        if (!canLocalPlayerAct()) {
            alert("Please wait for your turn!");
            return;
        }

        const tier = parseInt(e.target.dataset.tier);
        const cardId = e.target.dataset.id;
        try {
            game.reserveVisibleCard(tier, cardId);
            playSound(sfxReserve, 1.2);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'RESERVE_CARD', tier, cardId } });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Purchase Reserved Card
    if (e.target.classList.contains('buy-res-btn') && e.target.dataset.id) {
        if (!canLocalPlayerAct()) {
            alert("Please wait for your turn!");
            return;
        }

        const cardId = e.target.dataset.id;
        try {
            game.purchaseReservedCard(cardId);
            playSound(sfxPurchase, 1.5);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'BUY_RESERVED', cardId } });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Discard Tokens Confirmation Button
    if (e.target.id === 'confirm-discard-btn') {
        if (!canLocalPlayerAct()) return;

        try {
            const selects = document.querySelectorAll('.discard-select');
            const tokensToDiscard = Array.from(selects).map(s => s.value);
            game.discardTokens(tokensToDiscard);

            if (currentGameMode === 'online' && currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'DISCARD_TOKENS', tokens: tokensToDiscard } });
            }

            ui.hideDiscardModal();
            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }
});