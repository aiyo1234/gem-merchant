import { RuleEngine } from '../engine/RuleEngine.js';

export class UIRenderer {
    constructor(gameState) {
        this.game = gameState;
        this.setupCardZoomModal();
    }

    getCardArtPath(card) {
        const photoIndex = card.artIndex || 1;
        return `malaysian_cuisine_cards/card_t1_${photoIndex}.png`;
    }

    getPatronArtPath(index) {
        const totalPatronPhotos = 5; // Updated to use all 5 unique patron photos
        const patronIndex = (index % totalPatronPhotos) + 1;
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
    }

    setupCardZoomModal() {
        let modal = document.getElementById('card-zoom-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'card-zoom-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(4, 13, 22, 0.85)', display: 'none',
                justifyContent: 'center', alignItems: 'center', zIndex: 2500,
                backdropFilter: 'blur(3px)'
            });
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
            <div style="background: #0b1c2c; padding: 30px; border-radius: 12px; border: 2px solid #d4af37; display: flex; gap: 30px; max-width: 500px; width: 90%; box-shadow: 0 15px 35px rgba(0,0,0,0.8); position: relative;">
                <button id="close-zoom-btn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: #e6d3a8; font-size: 1.5em; cursor: pointer;">&times;</button>
                
                <div style="width: 180px; height: 266px; background-image: url('${artPath}'); background-size: cover; background-position: center; border-radius: 8px; border: 2px solid #d4af37; position: relative; flex-shrink: 0;">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(11, 28, 44, 0.7) 0%, rgba(11, 28, 44, 0.2) 50%, rgba(11, 28, 44, 0.8) 100%); border-radius: 6px; pointer-events: none;"></div>
                    <div style="position: relative; z-index: 2; padding: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
                        <span style="font-size: 1.8em; font-weight: bold; color: #fff; text-shadow: 1px 1px 3px rgba(0,0,0,0.9);">${points > 0 ? points : ''}</span>
                        ${bonus}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; justify-content: center; color: #e6d3a8; flex-grow: 1; font-family: sans-serif;">
                    <h3 style="font-family: 'Cinzel', serif; color: #d4af37; margin-top: 0; margin-bottom: 15px; font-size: 1.3em; border-bottom: 1px solid #5a4b31; padding-bottom: 8px;">${isPatron ? 'Patron Details' : 'Card Inspection'}</h3>
                    <div style="margin-bottom: 15px;">
                        <b style="font-family: 'Cinzel', serif; color: #f2d08a; font-size: 0.9em; text-transform: uppercase;">${isPatron ? 'Requirements' : 'Acquisition Cost'}:</b>
                        <div style="margin-top: 8px; max-height: 150px; overflow-y: auto;">${costHTML || 'None'}</div>
                    </div>
                    <button id="modal-close-action" class="buy-btn" style="margin-top: auto; padding: 8px; font-size: 0.9em; width: 100%;">Close Inspection</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';

        document.getElementById('close-zoom-btn').onclick = () => modal.style.display = 'none';
        document.getElementById('modal-close-action').onclick = () => modal.style.display = 'none';
    }

    updateHeader() {
        const statusEl = document.getElementById('game-status');
        if (!statusEl) return;
        
        if (this.game.isGameOver) {
            statusEl.innerHTML = `<div class="turn-banner game-over">🏆 GAME OVER! WINNER: ${this.game.players[0]?.name?.toUpperCase() || 'NONE'} 🏆</div>`;
        } else if (this.game.isFinalRound) {
            statusEl.innerHTML = `<div class="turn-banner final-round">⚡ FINAL ROUND! ⚡</div>`;
        } else {
            const currentPlayer = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
            const playerName = currentPlayer ? currentPlayer.name : "PLAYER";
            const isAiTurn = this.game.isVsAi && this.game.currentPlayerIndex !== 0;
            
            if (isAiTurn) {
                statusEl.innerHTML = `<div class="turn-banner ai-turn">🤖 ${playerName.toUpperCase()} IS THINKING...</div>`;
            } else {
                statusEl.innerHTML = `<div class="turn-banner my-turn">⭐ YOUR TURN (${playerName.toUpperCase()}) ⭐</div>`;
            }
        }
    }

    renderBank() {
        const container = document.getElementById('bank-sidebar');
        if (!container) return;
        
        container.innerHTML = `
            <div style="font-size: 0.8em; color: #e6d3a8; text-transform: uppercase; text-align: center; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px;">
                Bank Tokens <br><span style="font-size: 0.7em; color: #a38d59;">(Click to select)</span>
            </div>
            
            <div class="bank-token-vertical-list" id="tokens-list"></div>
            
            <div id="bank-actions" style="visibility: hidden; display: flex; flex-direction: column; gap: 8px; margin-top: 15px; width: 100%;">
                <span id="pending-tokens-display" style="text-align: center; color: #e6d3a8; font-family: sans-serif; font-size: 0.75em; text-transform: uppercase;"></span>
                <button id="confirm-tokens-btn" class="buy-btn" style="width: 100%; padding: 6px;">Confirm</button>
                <button id="clear-tokens-btn" class="res-btn" style="width: 100%; padding: 6px;">Clear</button>
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
            displaySpan.innerHTML = `[ ${formatted} ]`;
        } else {
            actionsDiv.style.visibility = 'hidden';
        }
    }

    renderPatrons() {
        const container = document.getElementById('patrons-container');
        if (!container) return;
        container.dataset.label = "TIER";
        container.innerHTML = '<div class="patron-row-title">PATRONS</div>';
        
        const grid = document.createElement('div');
        grid.className = 'card-grid';
        
        if (this.game.availablePatrons) {
            this.game.availablePatrons.forEach((patron, index) => {
                const pDiv = document.createElement('div');
                pDiv.className = 'card patron-card zoomable-card'; 
                
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
                    <div class="splendor-cost-container">
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
        const isMyTurn = currentPlayer && currentPlayer.name.toLowerCase() === 'you';

        for (let tier = 1; tier <= 3; tier++) {
            const container = document.getElementById(`market-tier-${tier}`);
            if (!container) continue;
            container.dataset.label = `TIER`;
            container.innerHTML = `<div class="patron-row-title">TIER ${tier}</div>`; 
            
            const grid = document.createElement('div');
            grid.className = 'card-grid';
            
            const marketCards = this.game.visibleMarket && this.game.visibleMarket[tier] ? this.game.visibleMarket[tier] : [];
            marketCards.forEach(card => {
                const cardDiv = document.createElement('div');
                
                let canAfford = false;
                if (isMyTurn) {
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
        container.innerHTML = '<h2 style="color: #e6d3a8; margin-bottom: 5px; font-size: 1em;">PLAYERS</h2>';

        if (!this.game.players || this.game.players.length === 0) return;

        this.game.players.forEach((player, index) => {
            const isActive = index === this.game.currentPlayerIndex;
            const isUser = player.name.toLowerCase() === 'you'; 
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-board ${isActive ? 'active-player' : ''}`;
            
            const tokensString = Object.entries(player.tokens || {})
                .filter(([_, amt]) => amt > 0)
                .map(([res, amt]) => `<span class="inline-gem"><span class="mini-dot gem-${res}"></span> ${amt}</span>`).join(' &nbsp; ') || 'None';
                
            const bonusesString = Object.entries(player.bonuses || {})
                .filter(([_, amt]) => amt > 0)
                .map(([res, amt]) => `<span class="inline-gem"><span class="mini-dot gem-${res}"></span> ${amt}</span>`).join(' &nbsp; ') || 'None';

            let acquiredPatronsHTML = '';
            if (player.patrons && player.patrons.length > 0) {
                const patronBadges = player.patrons.map((patron, pIdx) => {
                    const artIndex = pIdx % 5; // Updated to support up to 5 unique patrons
                    return `<div class="claimed-patron-badge" style="background-image: url('malaysian_cuisine_cards/patron_${(artIndex + 1)}.jpg');" title="${patron.points} Pts"></div>`;
                }).join(' ');

                acquiredPatronsHTML = `
                    <div style="margin-top: 6px;">
                        <b style="color: #d4af37; text-transform: uppercase; font-size: 0.75em;">Claimed Patrons:</b><br>
                        <div style="display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap;">${patronBadges}</div>
                    </div>
                `;
            } else {
                acquiredPatronsHTML = `<div class="player-text" style="margin-top:6px;"><b>Patrons:</b> 0</div>`;
            }

            let reservedHTML = '';
            const reservedCount = player.reservedCards ? player.reservedCards.length : 0;

            if (isUser) {
                if (player.reservedCards && player.reservedCards.length > 0) {
                    reservedHTML = `<div style="margin-top: 8px; border-top: 1px dashed #5a4b31; padding-top: 6px;">
                        <div style="font-size: 0.75em; color: #d4af37; margin-bottom: 4px; font-weight: bold;">Reserved Cards (${reservedCount}/3):</div>`;
                    
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
                            <div class="zoomable-reserved-card" data-card-id="${card.id}" style="background: rgba(0,0,0,0.3); padding: 4px; margin-bottom: 4px; border-radius: 4px; font-size: 0.7em; cursor: pointer; border: 1px solid rgba(212,175,55,0.3);">
                                <b>${card.points} Pts</b> (<span class="mini-dot gem-${card.bonus}"></span>) Cost: ${costStr}<br>
                                <button class="buy-res-btn" data-id="${card.id}" style="margin-top: 3px; width: 100%; padding: 2px;" class="buy-btn">
                                    ${canAffordRes ? '🟢 Buy Reserved' : 'Buy Reserved'}
                                </button>
                            </div>`;
                    });
                    reservedHTML += `</div>`;
                } else {
                    reservedHTML = `<div class="player-text" style="margin-top:6px;"><b>Reserved Cards:</b> 0/3</div>`;
                }
            } else {
                reservedHTML = `<div class="player-text" style="margin-top:6px;"><b>Reserved Cards:</b> ${reservedCount} hidden card(s)</div>`;
            }

            const activeBadge = isActive ? `<span class="active-turn-badge">${isUser ? 'YOUR TURN' : 'ACTIVE'}</span>` : '';

            playerDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #5a4b31; padding-bottom:4px; margin-bottom:8px;">
                    <h3 style="margin: 0; color: ${isActive ? '#2ecc71' : '#e6d3a8'}; font-size: 0.95em;">${(player.name || 'Player').toUpperCase()} ${activeBadge}</h3>
                    <span style="font-size: 0.95em; color:#e6d3a8;">(${player.prestige || 0} Pts)</span>
                </div>
                <div class="player-text"><b>Tokens:</b> ${tokensString}</div>
                <div class="player-text" style="margin-top:4px;"><b>Discounts:</b> ${bonusesString}</div>
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
            Object.assign(overlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(11, 28, 44, 0.92)', display: 'none',
                justifyContent: 'center', alignItems: 'center', zIndex: 2000
            });
            document.body.appendChild(overlay);
        }

        if (this.game.isGameOver) {
            const winner = this.game.players[0];
            overlay.innerHTML = `
                <div style="background: #0b1c2c; padding: 40px; border-radius: 8px; text-align: center; color: #e6d3a8; border: 2px solid #d4af37; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
                    <h1 style="color: #f1c40f; margin-top: 0; font-size: 2em; letter-spacing: 2px;">🏆 VICTORY! 🏆</h1>
                    <p style="font-family: sans-serif; font-size: 1.2em; margin: 15px 0;">Winner: <b>${winner.name.toUpperCase()}</b></p>
                    <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 6px; margin: 20px 0; font-family: sans-serif;">
                        Final Score: <b>${winner.prestige} Points</b><br>
                        Cards Acquired: <b>${winner.purchasedCards.length}</b>
                    </div>
                    <button id="restart-game-btn" class="buy-btn" style="font-size: 1.1em; padding: 10px 24px; width: auto; margin-top: 10px;">Play Again</button>
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
            Object.assign(overlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(11, 28, 44, 0.9)', display: 'none',
                justifyContent: 'center', alignItems: 'center', zIndex: 1000
            });
            document.body.appendChild(overlay);
        }
        
        const player = this.game.getCurrentPlayer ? this.game.getCurrentPlayer() : null;
        if (!player) return;

        const tokenCounts = Object.entries(player.tokens || {})
            .filter(([_, amt]) => amt > 0)
            .map(([res, amt]) => `<span class="inline-gem"><span class="mini-dot gem-${res}"></span> <b>${amt}</b></span>`)
            .join(' &nbsp;|&nbsp; ');

        let dropdownsHTML = '';
        for(let i = 0; i < excess; i++) {
            let options = Object.entries(player.tokens || {}).filter(([_, amt]) => amt > 0).map(([res, amt]) => `<option value="${res}">${res.charAt(0).toUpperCase() + res.slice(1)}</option>`).join('');
            dropdownsHTML += `<select class="discard-select" style="margin: 5px; padding: 8px; font-family: sans-serif;">${options}</select><br>`;
        }

        overlay.innerHTML = `
            <div style="background: #0b1c2c; padding: 30px; border-radius: 4px; text-align: center; color: #e6d3a8; border: 1px solid #d4af37;">
                <h2 style="color: #e74c3c; margin-top: 0;">Limit Exceeded</h2>
                <p style="font-family: sans-serif;">You have <b>${player.getTotalTokenCount ? player.getTotalTokenCount() : 0}</b> tokens. You must discard <b>${excess}</b>.</p>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; margin: 15px 0; font-family: sans-serif; font-size: 0.9em;">${tokenCounts}</div>
                ${dropdownsHTML}
                <button id="confirm-discard-btn" class="buy-btn" style="margin-top: 20px; font-size: 1em; padding: 8px 16px; width: auto;">Discard Tokens</button>
            </div>
        `;
        overlay.style.display = 'flex';
    }

    hideDiscardModal() {
        const overlay = document.getElementById('discard-overlay');
        if (overlay) overlay.style.display = 'none';
    }
}