import { GameState } from './engine/GameState.js';
import { UIRenderer } from './ui/UIRenderer.js';

const game = new GameState();
const ui = new UIRenderer(game);
window.gameUI = ui;

// Connect to your multiplayer server
const socket = io('https://gem-merchant.onrender.com'); 

let selectedTokens = [];
let chosenPlayerCount = 2; // Default to 2 players
let currentRoomCode = null;
let myPlayerName = 'Player';

// Audio Helpers
const sfxPurchase = new Audio('malaysian_cuisine_cards/Apple pay sucesssound track.mp3'); 
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

// Socket Sync Listeners for Multiplayer
socket.on('update_room', (roomData) => {
    console.log("Room players updated:", roomData.players);
});

socket.on('sync_game_state', (actionData) => {
    if (actionData.type === 'TAKE_TOKENS') {
        game.takeDifferentResources(actionData.selectedTokens);
    } else if (actionData.type === 'BUY_CARD') {
        game.purchaseVisibleCard(actionData.tier, actionData.cardId);
    } else if (actionData.type === 'RESERVE_CARD') {
        game.reserveVisibleCard(actionData.tier, actionData.cardId);
    }
    ui.renderAll();
});

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

    // Player Count Button Selector
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
        
        const names = [];
        const possibleNames = ['You', 'Friend 2', 'Friend 3', 'Friend 4'];
        for (let i = 0; i < chosenPlayerCount; i++) {
            names.push(possibleNames[i]);
        }
        game.initializeGame(names, false); // false = Multiplayer Pass & Play
        ui.renderAll();
        return;
    }

    // Online Room Join Handler (Fixed Layout Glitch)
    if (e.target.id === 'join-online-room-btn') {
        currentRoomCode = prompt("Enter Shared Room Code (e.g. room123):");
        myPlayerName = prompt("Enter Your Chef Name:", "Chef Shiaw");
        if (!currentRoomCode || !myPlayerName) return;

        socket.emit('join_room', { roomCode: currentRoomCode, playerName: myPlayerName });
        
        const overlay = document.getElementById('mode-select-overlay');
        if (overlay) overlay.style.display = 'none';
        
        const names = [myPlayerName];
        for (let i = 1; i < chosenPlayerCount; i++) {
            names.push(`Player ${i + 1}`);
        }
        
        game.initializeGame(names, false); 
        ui.renderAll();
        return;
    }

    if (game.isGameOver) return;

    // Token Selection in Bank
    if (e.target.classList.contains('bank-token')) {
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
        try {
            if (selectedTokens.length === 0) return;
            const unique = new Set(selectedTokens);
            if (unique.size === selectedTokens.length) {
                game.takeDifferentResources(selectedTokens);
            } else if (selectedTokens.length === 2 && selectedTokens[0] === selectedTokens[1]) {
                game.takeTwoResources(selectedTokens[0]);
            }
            playSound(sfxToken, 1.6);
            
            if (currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'TAKE_TOKENS', selectedTokens } });
            }

            selectedTokens = [];
            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    if (e.target.id === 'clear-tokens-btn') {
        selectedTokens = [];
        ui.renderAll();
    }

    // Purchase Visible Card
    if (e.target.classList.contains('buy-btn') && e.target.dataset.tier) {
        const tier = parseInt(e.target.dataset.tier);
        const cardId = e.target.dataset.id;
        try {
            game.purchaseVisibleCard(tier, cardId);
            playSound(sfxPurchase, 1.5);

            if (currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'BUY_CARD', tier, cardId } });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }

    // Reserve Card
    if (e.target.classList.contains('res-btn') && e.target.dataset.tier) {
        const tier = parseInt(e.target.dataset.tier);
        const cardId = e.target.dataset.id;
        try {
            game.reserveVisibleCard(tier, cardId);
            playSound(sfxReserve, 1.2);

            if (currentRoomCode) {
                socket.emit('game_action', { roomCode: currentRoomCode, actionData: { type: 'RESERVE_CARD', tier, cardId } });
            }

            ui.renderAll();
        } catch (err) {
            alert(err.message);
        }
    }
});