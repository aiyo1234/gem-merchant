import { RuleEngine } from '../engine/RuleEngine.js';

export class UIRenderer {
    constructor(gameState) {
        this.game = gameState;
        this.localPlayerName = 'You';
        this.gameMode = 'solo'; // 'solo' | 'pass_and_play' | 'online'
        this.currentRoomCode = null;
        this.setupCardZoomModal();
    }

    isCurrentPlayerLocal() {
        const currentPlayer = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
        if (!currentPlayer) return false;
        if (this.gameMode === 'solo') {
            return this.game.currentPlayerIndex === 0;
        }
        if (this.gameMode === 'pass_and_play') {
            return true;
        }
        if (this.gameMode === 'online') {
            return currentPlayer.name.trim().toLowerCase() === (this.localPlayerName || '').trim().toLowerCase();
        }
        return true;
    }

    isPlayerLocal(player) {
        if (!player) return false;
        if (this.gameMode === 'solo') {
            return player.name.toLowerCase() === 'you';
        }
        if (this.gameMode === 'pass_and_play') {
            const currentPlayer = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
            return currentPlayer && currentPlayer.name === player.name;
        }
        if (this.gameMode === 'online') {
            return player.name.trim().toLowerCase() === (this.localPlayerName || '').trim().toLowerCase();
        }
        return true;
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    }

    getCardArtPath(card) {
        const photoIndex = card && card.artIndex ? card.artIndex : 1;
        return `malaysian_cuisine_cards/card_t1_${photoIndex}.png`;
    }

    getPatronArtPath(index) {
        const patronIndex = (index % 5) + 1;
        return `malaysian_cuisine_cards/patron_${patronIndex}.jpg`;
    }

    sortCostEntries(costObj) {
        return Object.entries(costObj || {}).sort(([, a], [, b]) => b - a);
    }

    renderAll() {
        this.updateHeader();
        this.renderBank();
        this.renderMarket();
        this.renderPatrons();
        this.renderPlayers();
        this.checkVictoryModal();

        if (this.game.needsToDiscard) {
            const currentPlayer = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
            if (currentPlayer) {
                const excess = currentPlayer.getTotalTokenCount() - 10;
                if (excess > 0 && this.isCurrentPlayerLocal()) {
                    this.renderDiscardModal(excess);
                } else {
                    this.hideDiscardModal();
                }
            }
        } else {
            this.hideDiscardModal();
        }
    }

    setupCardZoomModal() {
        let modal = document.getElementById('card-zoom-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'card-zoom-modal';
            modal.className = 'modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);

            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        }
    }

    showCardZoomModal(cardData, isPatron = false) {
        const modal = document.getElementById('card-zoom-modal');
        if (!modal) return;

        const artPath = isPatron ? cardData.artPath : this.getCardArtPath(cardData);
        const points = cardData.points || 0;
        const bonus = cardData.bonus ? `<div class="card-bonus-badge gem-${cardData.bonus}" style="width:36px; height:36px;"></div>` : '';
        
        const costOrReqs = cardData.cost || cardData.requirements || {};
        const sortedCost = this.sortCostEntries(costOrReqs);

        const costHTML = sortedCost
            .map(([res, amt]) => `<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><div class="cost-badge gem-${res}" style="width:32px; height:32px; font-size:1em;">${amt}</div> <span style="text-transform:capitalize; font-weight:bold;">${res}</span></div>`)
            .join('');

        modal.innerHTML = `
            <div class="modal-box" style="display: flex; gap: 25px; max-width: 520px; text-align: left; position: relative;">
                <button id="close-zoom-btn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: var(--text-gold); font-size: 1.6em; cursor: pointer;">&times;</button>
                
                <div style="width: 170px; height: 250px; background-image: url('${artPath}'); background-size: cover; background-position: center; border-radius: 8px; border: 2px solid var(--panel-border); position: relative; flex-shrink: 0; box-shadow: 0 8px 20px rgba(0,0,0,0.8);">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(11, 28, 44, 0.6) 0%, transparent 50%, rgba(11, 28, 44, 0.8) 100%); border-radius: 6px; pointer-events: none;"></div>
                    <div style="position: relative; z-index: 2; padding: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
                        <span style="font-family: 'Cinzel', serif; font-size: 1.8em; font-weight: 900; color: #fff; text-shadow: 1px 1px 4px rgba(0,0,0,0.9);">${points > 0 ? points : ''}</span>
                        ${bonus}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; justify-content: center; color: var(--text-gold); flex-grow: 1;">
                    <h3 style="font-family: 'Cinzel', serif; color: var(--gold); margin-top: 0; margin-bottom: 8px; font-size: 1.3em; border-bottom: 1px solid #5a4b31; padding-bottom: 6px;">${isPatron ? 'Noble Patron' : `Tier ${cardData.tier} Development Card`}</h3>
                    <div style="margin-bottom: 15px;">
                        <b style="color: var(--gold-light); font-size: 0.85em; text-transform: uppercase;">${isPatron ? 'Requirements' : 'Token Cost'}:</b>
                        <div style="margin-top: 8px; max-height: 140px; overflow-y: auto;">${costHTML || 'None'}</div>
                    </div>
                    <button id="modal-close-action" class="buy-btn" style="margin-top: auto; padding: 8px; font-size: 0.85em; width: 100%;">Close Preview</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';

        document.getElementById('close-zoom-btn').onclick = () => modal.style.display = 'none';
        document.getElementById('modal-close-action').onclick = () => modal.style.display = 'none';
    }

    updateHeader() {
        const statusEl = document.getElementById('game-status');
        const roomBadge = document.getElementById('in-game-room-badge');
        const roomText = document.getElementById('header-room-code-text');

        if (this.gameMode === 'online' && this.currentRoomCode) {
            if (roomBadge) roomBadge.style.display = 'flex';
            if (roomText) roomText.innerText = this.currentRoomCode;
        } else {
            if (roomBadge) roomBadge.style.display = 'none';
        }

        if (!statusEl) return;
        
        if (this.game.isGameOver) {
            const winner = this.game.players[0]?.name?.toUpperCase() || 'NONE';
            statusEl.innerHTML = `<div class="turn-banner game-over">🏆 GAME OVER! WINNER: ${winner} 🏆</div>`;
        } else if (this.game.isFinalRound) {
            statusEl.innerHTML = `<div class="turn-banner final-round">⚡ FINAL ROUND! ⚡</div>`;
        } else {
            const currentPlayer = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
            const playerName = currentPlayer ? currentPlayer.name : "PLAYER";
            const isAiTurn = this.game.isVsAi && this.game.currentPlayerIndex !== 0;
            
            if (isAiTurn) {
                statusEl.innerHTML = `<div class="turn-banner ai-turn">🤖 ${playerName.toUpperCase()} IS THINKING...</div>`;
            } else if (this.isCurrentPlayerLocal()) {
                statusEl.innerHTML = `<div class="turn-banner my-turn">⭐ YOUR TURN (${playerName.toUpperCase()}) ⭐</div>`;
            } else {
                statusEl.innerHTML = `<div class="turn-banner waiting-turn">⏳ WAITING FOR ${playerName.toUpperCase()}'S MOVE...</div>`;
            }
        }
    }

    renderBank() {
        const container = document.getElementById('bank-sidebar');
        if (!container) return;
        
        container.innerHTML = `
            <div style="font-size: 0.85em; color: var(--gold); text-transform: uppercase; text-align: center; margin-bottom: 8px; font-weight: bold; letter-spacing: 1px; font-family: 'Cinzel', serif;">
                Bank Tokens
            </div>
            <div style="font-size: 0.7em; color: var(--text-muted); text-align: center; margin-bottom: 12px; line-height: 1.3;">
                Pick 3 different OR 2 same (if 4+ available)
            </div>
            
            <div class="bank-token-vertical-list" id="tokens-list"></div>
            
            <div id="bank-actions" style="visibility: hidden; display: flex; flex-direction: column; gap: 8px; margin-top: 15px; width: 100%; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.3);">
                <div style="font-size: 0.7em; text-transform: uppercase; color: var(--text-muted); text-align: center;">Selected Tokens:</div>
                <span id="pending-tokens-display" style="text-align: center; color: var(--text-gold); font-size: 0.8em; min-height: 18px;"></span>
                <button id="confirm-tokens-btn" class="buy-btn" style="width: 100%; padding: 7px;">Confirm Tokens</button>
                <button id="clear-tokens-btn" class="res-btn" style="width: 100%; padding: 6px;">Clear Selection</button>
            </div>
        `;
        
        const tokensList = document.getElementById('tokens-list');
        if (this.game.bank && this.game.bank.tokens) {
            for (const [resource, count] of Object.entries(this.game.bank.tokens)) {
                const tokenDiv = document.createElement('div');
                tokenDiv.className = `token ${resource} bank-token`; 
                tokenDiv.setAttribute('data-count', count);
                tokenDiv.dataset.resource = resource; 
                tokensList.appendChild(tokenDiv);
            }
        }
    }

    updatePendingTokensDisplay(pendingTokens) {
        const actionsDiv = document.getElementById('bank-actions');
        const displaySpan = document.getElementById('pending-tokens-display');
        if (!actionsDiv) return;
        
        if (pendingTokens && pendingTokens.length > 0) {
            actionsDiv.style.visibility = 'visible';
            const formatted = pendingTokens.map(res => `<span class="mini-dot gem-${res}" title="${res}"></span>`).join(' ');
            
            const player = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
            const currentCount = player && player.getTotalTokenCount ? player.getTotalTokenCount() : 0;
            const projected = currentCount + pendingTokens.length;
            const warningHTML = projected > 10 ? `<div style="color: #e74c3c; font-size: 0.72em; margin-top: 3px; font-weight: bold;">⚠️ Total: ${projected}/10 tokens (exceeds limit by ${projected - 10})</div>` : '';

            displaySpan.innerHTML = `[ ${formatted} ]${warningHTML}`;
        } else {
            actionsDiv.style.visibility = 'hidden';
        }
    }

    renderPatrons() {
        const container = document.getElementById('patrons-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="patron-row-title">
                <span>👑 NOBLE PATRONS (+3 PTS)</span>
                <span class="deck-count-indicator">${this.game.availablePatrons ? this.game.availablePatrons.length : 0} Available</span>
            </div>
        `;
        
        const grid = document.createElement('div');
        grid.className = 'card-grid';
        
        if (this.game.availablePatrons) {
            this.game.availablePatrons.forEach((patron, index) => {
                const pDiv = document.createElement('div');
                pDiv.className = 'card patron-card zoomable-card'; 
                pDiv.style.width = '100px';
                pDiv.style.height = '120px';
                
                const patronArt = this.getPatronArtPath(index);
                pDiv.style.backgroundImage = `url('${patronArt}')`;
                
                pDiv.onclick = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    this.showCardZoomModal({ ...patron, artPath: patronArt }, true);
                };
                
                const sortedReqs = this.sortCostEntries(patron.requirements);
                const reqString = sortedReqs
                    .map(([res, amt]) => `<div class="cost-badge gem-${res}">${amt}</div>`)
                    .join('');
                    
                pDiv.innerHTML = `
                    <div class="card-header">
                        <div class="card-points">${patron.points > 0 ? patron.points : ''}</div>
                    </div>
                    <div class="splendor-cost-container" style="flex-direction: row; flex-wrap: wrap;">
                        ${reqString}
                    </div>
                `;
                grid.appendChild(pDiv);
            });
        }
        
        container.appendChild(grid);
    }

    renderMarket() {
        const currentPlayer = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
        const isMyTurn = this.isCurrentPlayerLocal();

        const tierNames = { 3: 'TIER 3', 2: 'TIER 2', 1: 'TIER 1' };

        for (let tier = 1; tier <= 3; tier++) {
            const container = document.getElementById(`market-tier-${tier}`);
            if (!container) continue;
            
            const remainingDeck = this.game.decks && this.game.decks[tier] ? this.game.decks[tier].cards.length : 0;

            container.innerHTML = `
                <div class="patron-row-title">
                    <span>${tierNames[tier]}</span>
                    <span class="deck-count-indicator">Deck: ${remainingDeck} cards</span>
                </div>
            `; 
            
            const grid = document.createElement('div');
            grid.className = 'card-grid';
            
            const marketCards = this.game.visibleMarket && this.game.visibleMarket[tier] ? this.game.visibleMarket[tier] : [];
            marketCards.forEach(card => {
                const cardDiv = document.createElement('div');
                
                let canAfford = false;
                if (isMyTurn && currentPlayer) {
                    try {
                        RuleEngine.calculateActualCost(currentPlayer, card.cost);
                        canAfford = true;
                    } catch (e) {
                        canAfford = false;
                    }
                }
                
                cardDiv.className = `card market-card zoomable-card ${canAfford ? 'affordable-card' : ''}`;
                
                const artPath = this.getCardArtPath(card);
                cardDiv.style.backgroundImage = `url('${artPath}')`;

                cardDiv.onclick = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    this.showCardZoomModal(card, false);
                };

                const sortedCost = this.sortCostEntries(card.cost);
                const costBadgesHTML = sortedCost
                    .map(([res, amt]) => `<div class="cost-badge gem-${res}">${amt}</div>`)
                    .join('');

                const badgeHTML = canAfford ? `<div class="affordable-badge">Can Buy!</div>` : '';

                cardDiv.innerHTML = `
                    ${badgeHTML}
                    <div class="card-header">
                        <div class="card-points">${card.points > 0 ? card.points : ''}</div>
                        <div class="card-bonus-badge gem-${card.bonus}"></div>
                    </div>
                    <div class="splendor-cost-container">
                        ${costBadgesHTML}
                    </div>
                    <div class="btn-group">
                        <button class="buy-btn" data-tier="${tier}" data-id="${card.id}">BUY</button>
                        <button class="res-btn" data-tier="${tier}" data-id="${card.id}">HOLD</button>
                    </div>
                `;
                grid.appendChild(cardDiv);
            });
            container.appendChild(grid);
        }
    }

    renderPlayers() {
        const container = document.getElementById('players-sidebar');
        if (!container) return;
        container.innerHTML = '<div style="font-family: \'Cinzel\', serif; color: var(--gold); margin-bottom: 8px; font-size: 0.9em; font-weight: bold;">MERCHANT DASHBOARDS</div>';

        if (!this.game.players || this.game.players.length === 0) return;

        // Determine point leader for crown icon
        const maxPoints = Math.max(...this.game.players.map(p => p.prestige || 0));

        this.game.players.forEach((player, index) => {
            const isActive = index === this.game.currentPlayerIndex;
            const isUser = this.isPlayerLocal(player); 
            const isLeader = player.prestige > 0 && player.prestige === maxPoints;
            const isOnline = player.online !== false;

            const playerDiv = document.createElement('div');
            playerDiv.className = `player-board ${isActive ? 'active-player' : ''}`;
            
            const tokensString = Object.entries(player.tokens || {})
                .filter(([_, amt]) => amt > 0)
                .map(([res, amt]) => `<span class="inline-gem"><span class="mini-dot gem-${res}"></span> ${amt}</span>`).join(' ') || '<span style="color: var(--text-muted);">None</span>';
                
            const bonusesString = Object.entries(player.bonuses || {})
                .filter(([_, amt]) => amt > 0)
                .map(([res, amt]) => `<span class="inline-gem"><span class="mini-dot gem-${res}"></span> ${amt}</span>`).join(' ') || '<span style="color: var(--text-muted);">None</span>';

            let acquiredPatronsHTML = '';
            if (player.patrons && player.patrons.length > 0) {
                const patronBadges = player.patrons.map((patron, pIdx) => {
                    const artIndex = pIdx % 5;
                    return `<div class="claimed-patron-badge" style="background-image: url('malaysian_cuisine_cards/patron_${(artIndex + 1)}.jpg');" title="${patron.points} Pts"></div>`;
                }).join(' ');

                acquiredPatronsHTML = `
                    <div style="margin-top: 5px;">
                        <b style="color: var(--gold); text-transform: uppercase; font-size: 0.7em;">Patrons:</b>
                        <div style="display: flex; gap: 4px; margin-top: 2px; flex-wrap: wrap;">${patronBadges}</div>
                    </div>
                `;
            }

            let reservedHTML = '';
            const reservedCount = player.reservedCards ? player.reservedCards.length : 0;

            if (isUser) {
                if (player.reservedCards && player.reservedCards.length > 0) {
                    reservedHTML = `<div style="margin-top: 6px; border-top: 1px dashed #5a4b31; padding-top: 5px;">
                        <div style="font-size: 0.7em; color: var(--gold); margin-bottom: 3px; font-weight: bold;">Reserved (${reservedCount}/3):</div>`;
                    
                    player.reservedCards.forEach(card => {
                        let canAffordRes = false;
                        try {
                            RuleEngine.calculateActualCost(player, card.cost);
                            canAffordRes = true;
                        } catch(e) {
                            canAffordRes = false;
                        }

                        const sortedCost = this.sortCostEntries(card.cost);
                        const costStr = sortedCost.map(([res, amt]) => `<span class="inline-gem"><span class="mini-dot gem-${res}"></span> ${amt}</span>`).join(' ');
                        reservedHTML += `
                            <div class="zoomable-reserved-card" data-card-id="${card.id}" style="background: rgba(0,0,0,0.3); padding: 4px 6px; margin-bottom: 4px; border-radius: 4px; font-size: 0.7em; cursor: pointer; border: 1px solid rgba(212,175,55,0.3);">
                                <b>${card.points} Pts</b> (<span class="mini-dot gem-${card.bonus}"></span>) Cost: ${costStr}
                                <button class="buy-res-btn buy-btn" data-id="${card.id}" style="margin-top: 3px; width: 100%; padding: 3px; font-size: 0.85em;">
                                    ${canAffordRes ? '🟢 Buy Reserved' : 'Buy Reserved'}
                                </button>
                            </div>`;
                    });
                    reservedHTML += `</div>`;
                } else {
                    reservedHTML = `<div class="player-text"><b>Reserved:</b> 0/3</div>`;
                }
            } else {
                reservedHTML = `<div class="player-text"><b>Reserved:</b> ${reservedCount} hidden</div>`;
            }

            const statusDot = this.gameMode === 'online' 
                ? `<span class="${isOnline ? 'online-dot' : 'offline-dot'}" title="${isOnline ? 'Online' : 'Offline / Disconnected'}"></span>` 
                : '';

            playerDiv.innerHTML = `
                <div class="player-board-header">
                    <div class="player-name-text">
                        ${statusDot}
                        <span>${(player.name || 'Player').toUpperCase()} ${isUser ? '(YOU)' : ''}</span>
                        ${isLeader ? '👑' : ''}
                    </div>
                    <div class="player-prestige-badge">${player.prestige || 0} PTS</div>
                </div>
                <div class="player-text"><b>Tokens (${player.getTotalTokenCount ? player.getTotalTokenCount() : 0}):</b> ${tokensString}</div>
                <div class="player-text"><b>Discounts:</b> ${bonusesString}</div>
                ${acquiredPatronsHTML}
                ${reservedHTML}
            `;
            container.appendChild(playerDiv);

            if (isUser) {
                playerDiv.querySelectorAll('.zoomable-reserved-card').forEach(resEl => {
                    resEl.onclick = (e) => {
                        if (e.target.tagName === 'BUTTON') return;
                        const cardId = resEl.dataset.cardId;
                        const card = player.reservedCards.find(c => c.id === cardId);
                        if (card) this.showCardZoomModal(card, false);
                    };
                });
            }
        });
    }

    checkVictoryModal() {
        let overlay = document.getElementById('victory-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'victory-overlay';
            overlay.className = 'modal-overlay';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
        }

        if (this.game.isGameOver) {
            const winner = this.game.players[0];
            const isWinnerLocal = this.isPlayerLocal(winner);
            const isPassAndPlay = this.gameMode === 'pass_and_play';

            let titleHTML = '';
            let subtitleHTML = '';
            let boxBorderColor = 'var(--panel-border)';

            if (isPassAndPlay) {
                titleHTML = `<h1 style="color: var(--gold); margin-top: 0; font-size: 2em; letter-spacing: 2px;">🏆 MATCH COMPLETE! 🏆</h1>`;
                subtitleHTML = `<p style="font-size: 1.1em; margin: 10px 0;">Champion: <b style="color: #2ecc71;">${winner.name.toUpperCase()}</b></p>`;
            } else if (isWinnerLocal) {
                titleHTML = `<h1 style="color: #2ecc71; margin-top: 0; font-size: 2em; letter-spacing: 2px;">🏆 VICTORY! 🏆</h1>`;
                subtitleHTML = `<p style="font-size: 1.1em; margin: 10px 0; color: var(--gold);">Congratulations! You are the Grand Gem Master!</p>`;
                boxBorderColor = '#2ecc71';
            } else {
                titleHTML = `<h1 style="color: #e74c3c; margin-top: 0; font-size: 2em; letter-spacing: 2px;">💀 DEFEATED</h1>`;
                subtitleHTML = `<p style="font-size: 1.1em; margin: 10px 0;">Winner: <b style="color: var(--gold);">${winner.name.toUpperCase()}</b> (Better luck next trade!)</p>`;
                boxBorderColor = '#e74c3c';
            }

            const rankingsHTML = this.game.players.map((p, idx) => `
                <tr style="border-bottom: 1px solid rgba(212,175,55,0.2);">
                    <td style="padding: 8px; font-weight: bold; color: ${idx === 0 ? 'var(--gold)' : 'var(--text-gold)'};">#${idx + 1}</td>
                    <td style="padding: 8px; text-align: left;">${p.name} ${idx === 0 ? '👑' : ''}</td>
                    <td style="padding: 8px; font-weight: bold; color: var(--gold);">${p.prestige} Pts</td>
                    <td style="padding: 8px;">${p.purchasedCards.length} cards</td>
                </tr>
            `).join('');

            overlay.innerHTML = `
                <div class="modal-box" style="max-width: 480px; border-color: ${boxBorderColor};">
                    ${titleHTML}
                    ${subtitleHTML}
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; background: rgba(0,0,0,0.3); border-radius: 6px;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--panel-border); color: var(--gold);">
                                <th style="padding: 6px;">Rank</th>
                                <th style="padding: 6px; text-align: left;">Merchant</th>
                                <th style="padding: 6px;">Points</th>
                                <th style="padding: 6px;">Cards</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rankingsHTML}
                        </tbody>
                    </table>

                    <button id="restart-game-btn" class="buy-btn" style="font-size: 1em; padding: 10px 24px; width: 100%; margin-top: 10px;">Play Again</button>
                </div>
            `;
            overlay.style.display = 'flex';

            const restartBtn = document.getElementById('restart-game-btn');
            if (restartBtn) {
                restartBtn.onclick = () => window.location.reload();
            }
        } else {
            overlay.style.display = 'none';
        }
    }

    renderDiscardModal(excess) {
        let overlay = document.getElementById('discard-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'discard-overlay';
            overlay.className = 'modal-overlay';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
        }
        
        const player = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
        if (!player) return;

        const GEM_INFO = {
            ruby: { symbol: '🔴', name: 'Ruby', bg: '#2a0a0a', text: '#ff7675' },
            sapphire: { symbol: '🔵', name: 'Sapphire', bg: '#091c36', text: '#74b9ff' },
            emerald: { symbol: '🟢', name: 'Emerald', bg: '#0a2918', text: '#55efc4' },
            pearl: { symbol: '⚪', name: 'Pearl', bg: '#2d3436', text: '#dfe6e9' },
            onyx: { symbol: '⚫', name: 'Onyx', bg: '#131920', text: '#b2bec3' },
            gold: { symbol: '🟡', name: 'Gold', bg: '#352805', text: '#ffeaa7' }
        };

        const tokenCounts = Object.entries(player.tokens || {})
            .filter(([_, amt]) => amt > 0)
            .map(([res, amt]) => {
                const info = GEM_INFO[res] || { symbol: '💎', name: res };
                return `<span class="inline-gem" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: rgba(0,0,0,0.3); border-radius: 4px; margin: 2px;"><span class="mini-dot gem-${res}"></span> <span style="color: ${info.text || 'var(--text-gold)'}; font-weight: bold;">${info.symbol} ${amt}</span></span>`;
            })
            .join(' &nbsp;|&nbsp; ');

        let dropdownsHTML = '';
        for (let i = 0; i < excess; i++) {
            let options = Object.entries(player.tokens || {})
                .filter(([_, amt]) => amt > 0)
                .map(([res, amt]) => {
                    const info = GEM_INFO[res] || { symbol: '💎', name: res, bg: '#040d16', text: '#fff' };
                    return `<option value="${res}" style="background: ${info.bg}; color: ${info.text}; font-size: 1.05em; padding: 6px;">${info.symbol} ${info.name} (${amt} in hand)</option>`;
                }).join('');

            dropdownsHTML += `
                <div style="margin: 8px 0;">
                    <select class="discard-select" style="width: 220px; padding: 10px 14px; font-family: inherit; font-size: 1em; font-weight: 600; border-radius: 6px; border: 1.5px solid var(--gold); background: #071526; color: var(--text-gold); cursor: pointer; text-align: left; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
                        ${options}
                    </select>
                </div>
            `;
        }

        const currentCount = player.getTotalTokenCount ? player.getTotalTokenCount() : 0;

        overlay.innerHTML = `
            <div class="modal-box" style="max-width: 440px; text-align: center; border: 2px solid #e74c3c;">
                <h2 style="color: #e74c3c; margin-top: 0; font-family: 'Cinzel', serif; font-size: 1.5em; letter-spacing: 1.5px;">TOKEN LIMIT EXCEEDED</h2>
                <p style="font-size: 0.95em; color: var(--text-gold); margin-bottom: 10px;">
                    You hold <b>${currentCount}</b> tokens (maximum 10). You must discard <b>${excess}</b> token(s):
                </p>
                
                <div style="background: rgba(0,0,0,0.4); padding: 10px 12px; margin: 12px 0; border-radius: 8px; border: 1px solid var(--panel-border);">
                    ${tokenCounts}
                </div>

                <div style="margin: 15px 0;">
                    ${dropdownsHTML}
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
                    <button id="confirm-discard-btn" class="buy-btn" style="width: 100%; font-size: 0.95em; font-weight: bold; padding: 12px; letter-spacing: 1px; text-transform: uppercase;">
                        DISCARD SELECTED TOKENS
                    </button>
                    <button id="cancel-discard-btn" class="res-btn" style="width: 100%; padding: 8px; font-size: 0.85em; background: transparent; color: #2ecc71; border: 1px solid #2ecc71; border-radius: 6px; cursor: pointer;">
                        ⬅️ Go Back & Take Fewer Tokens
                    </button>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';
    }

    hideDiscardModal() {
        const overlay = document.getElementById('discard-overlay');
        if (overlay) overlay.style.display = 'none';
    }
}