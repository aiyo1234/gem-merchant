import { Player } from './Player.js';
import { ResourceBank } from './ResourceBank.js';
import { Card } from './Card.js';
import { Deck } from './Deck.js';
import { getInitialCards } from './cardData.js';
import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js'; 
import { Patron } from './Patron.js';

function getInitialPatrons() {
    return [
        { id: 'patron_1', points: 3, requirements: { ruby: 4, sapphire: 4 } },
        { id: 'patron_2', points: 3, requirements: { emerald: 4, onyx: 4 } },
        { id: 'patron_3', points: 3, requirements: { ruby: 3, sapphire: 3, emerald: 3 } },
        { id: 'patron_4', points: 3, requirements: { sapphire: 4, onyx: 4 } },
        { id: 'patron_5', points: 3, requirements: { ruby: 4, emerald: 4 } }
    ];
}

export class GameState {
    constructor() {
        this.players = [];
        this.bank = new ResourceBank();
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.decks = { 1: null, 2: null, 3: null };
        this.visibleMarket = { 1: [], 2: [], 3: [] };
        this.availablePatrons = [];
        this.isGameOver = false;
        this.isFinalRound = false;
        this.needsToDiscard = false; 
        this.isVsAi = false;
        this.isAiPlaying = false;
    }

    initializeGame(playerNames, isVsAi = false) {
        this.players = playerNames.map(name => new Player(name));
        this.isVsAi = isVsAi;
        this.bank.initialize(this.players.length);
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.isGameOver = false;
        this.isFinalRound = false;
        this.needsToDiscard = false;

        this.setupDecks();
        this.dealInitialMarket();
        this.setupPatrons();

        this.checkAndTriggerAiIfNeeded();
    }

    setupPatrons() {
        const allPatronsData = getInitialPatrons();
        const shuffled = allPatronsData.sort(() => 0.5 - Math.random());
        // Official rules: Display number of players + 1 patrons (3 for 2p, 4 for 3p, 5 for 4p)
        const patronCount = Math.min(allPatronsData.length, this.players.length + 1);
        const selected = shuffled.slice(0, patronCount);
        this.availablePatrons = selected.map(p => new Patron(p.id, p.points, p.requirements));
    }

    setupDecks() {
        const allCardsData = getInitialCards();
        const cardsByTier = { 1: [], 2: [], 3: [] };

        // Unique photo pools for each tier so no two visible cards in market ever overlap
        // Tier 1 gets photos 1 to 20
        const tier1Pool = [];
        for (let i = 1; i <= 20; i++) tier1Pool.push(i);
        tier1Pool.sort(() => 0.5 - Math.random());

        // Tier 2 gets photos 21 to 35
        const tier2Pool = [];
        for (let i = 21; i <= 35; i++) tier2Pool.push(i);
        tier2Pool.sort(() => 0.5 - Math.random());

        // Tier 3 gets photos 36 to 45
        const tier3Pool = [];
        for (let i = 36; i <= 45; i++) tier3Pool.push(i);
        tier3Pool.sort(() => 0.5 - Math.random());

        let idx1 = 0, idx2 = 0, idx3 = 0;

        allCardsData.forEach(data => {
            let assignedPhoto = 1;
            if (data.tier === 1) {
                assignedPhoto = tier1Pool[idx1 % tier1Pool.length];
                idx1++;
            } else if (data.tier === 2) {
                assignedPhoto = tier2Pool[idx2 % tier2Pool.length];
                idx2++;
            } else if (data.tier === 3) {
                assignedPhoto = tier3Pool[idx3 % tier3Pool.length];
                idx3++;
            }
            const card = new Card(data.id, data.tier, data.points, data.bonus, data.cost, assignedPhoto);
            cardsByTier[data.tier].push(card);
        });

        for (let tier = 1; tier <= 3; tier++) {
            cardsByTier[tier].sort(() => 0.5 - Math.random());
        }

        this.decks[1] = new Deck(1, cardsByTier[1]);
        this.decks[2] = new Deck(2, cardsByTier[2]);
        this.decks[3] = new Deck(3, cardsByTier[3]);
    }

    serializeInitialState() {
        return {
            playerNames: this.players.map(p => p.name),
            isVsAi: this.isVsAi,
            bank: { ...this.bank.tokens },
            decks: {
                1: this.decks[1].cards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                2: this.decks[2].cards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                3: this.decks[3].cards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex }))
            },
            visibleMarket: {
                1: this.visibleMarket[1].map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                2: this.visibleMarket[2].map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                3: this.visibleMarket[3].map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex }))
            },
            availablePatrons: this.availablePatrons.map(p => ({ id: p.id, points: p.points, requirements: p.requirements }))
        };
    }

    serializeCurrentState() {
        return {
            isVsAi: this.isVsAi,
            currentPlayerIndex: this.currentPlayerIndex,
            turnNumber: this.turnNumber,
            isGameOver: this.isGameOver,
            isFinalRound: this.isFinalRound,
            needsToDiscard: this.needsToDiscard,
            bank: { ...this.bank.tokens },
            players: this.players.map(p => ({
                name: p.name,
                tokens: { ...p.tokens },
                bonuses: { ...p.bonuses },
                prestige: p.prestige,
                purchasedCards: p.purchasedCards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                reservedCards: p.reservedCards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                patrons: p.patrons.map(pt => ({ id: pt.id, points: pt.points, requirements: pt.requirements }))
            })),
            decks: {
                1: this.decks[1].cards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                2: this.decks[2].cards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                3: this.decks[3].cards.map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex }))
            },
            visibleMarket: {
                1: this.visibleMarket[1].map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                2: this.visibleMarket[2].map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex })),
                3: this.visibleMarket[3].map(c => ({ id: c.id, tier: c.tier, points: c.points, bonus: c.bonus, cost: c.cost, artIndex: c.artIndex }))
            },
            availablePatrons: this.availablePatrons.map(p => ({ id: p.id, points: p.points, requirements: p.requirements }))
        };
    }

    loadInitialState(data) {
        this.players = data.playerNames.map(name => new Player(name));
        this.isVsAi = data.isVsAi || false;
        this.bank = new ResourceBank();
        this.bank.tokens = { ...data.bank };
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.isGameOver = false;
        this.isFinalRound = false;
        this.needsToDiscard = false;

        this.decks = {
            1: new Deck(1, data.decks[1].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)), false),
            2: new Deck(2, data.decks[2].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)), false),
            3: new Deck(3, data.decks[3].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)), false)
        };
        this.visibleMarket = {
            1: data.visibleMarket[1].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)),
            2: data.visibleMarket[2].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)),
            3: data.visibleMarket[3].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex))
        };
        this.availablePatrons = data.availablePatrons.map(p => new Patron(p.id, p.points, p.requirements));
    }

    loadCurrentState(data) {
        this.isVsAi = data.isVsAi || false;
        this.currentPlayerIndex = data.currentPlayerIndex || 0;
        this.turnNumber = data.turnNumber || 1;
        this.isGameOver = data.isGameOver || false;
        this.isFinalRound = data.isFinalRound || false;
        this.needsToDiscard = data.needsToDiscard || false;
        
        this.bank = new ResourceBank();
        this.bank.tokens = { ...data.bank };

        this.players = data.players.map(pd => {
            const p = new Player(pd.name);
            p.tokens = { ...pd.tokens };
            p.bonuses = { ...pd.bonuses };
            p.prestige = pd.prestige || 0;
            p.purchasedCards = (pd.purchasedCards || []).map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex));
            p.reservedCards = (pd.reservedCards || []).map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex));
            p.patrons = (pd.patrons || []).map(pt => new Patron(pt.id, pt.points, pt.requirements));
            return p;
        });

        this.decks = {
            1: new Deck(1, data.decks[1].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)), false),
            2: new Deck(2, data.decks[2].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)), false),
            3: new Deck(3, data.decks[3].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)), false)
        };
        this.visibleMarket = {
            1: data.visibleMarket[1].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)),
            2: data.visibleMarket[2].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex)),
            3: data.visibleMarket[3].map(c => new Card(c.id, c.tier, c.points, c.bonus, c.cost, c.artIndex))
        };
        this.availablePatrons = data.availablePatrons.map(p => new Patron(p.id, p.points, p.requirements));
    }

    dealInitialMarket() {
        for (let tier = 1; tier <= 3; tier++) {
            for (let i = 0; i < 4; i++) { // Always 4 visible cards per tier market
                const drawnCard = this.decks[tier].draw();
                if (drawnCard) this.visibleMarket[tier].push(drawnCard);
            }
        }
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    checkPatronVisits() {
        const player = this.getCurrentPlayer();
        const qualifiedIndex = this.availablePatrons.findIndex(patron => 
            RuleEngine.checkPatronQualification(player, patron)
        );

        if (qualifiedIndex !== -1) {
            const earnedPatron = this.availablePatrons.splice(qualifiedIndex, 1)[0];
            player.patrons.push(earnedPatron);
            player.prestige += earnedPatron.points;
        }
    }

    checkEndTurn() {
        if (this.getCurrentPlayer().getTotalTokenCount() > RULES.MAX_PLAYER_TOKENS) {
            this.needsToDiscard = true;
            if (this.isVsAi && this.currentPlayerIndex !== 0) {
                this.handleAiDiscard();
            }
        } else {
            this.needsToDiscard = false;
            this.advanceTurn();
        }
    }

    handleAiDiscard() {
        const aiPlayer = this.getCurrentPlayer();
        const excess = aiPlayer.getTotalTokenCount() - RULES.MAX_PLAYER_TOKENS;
        if (excess <= 0) return;

        // Patron desirability analysis
        const patronBonusDesirability = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        (this.availablePatrons || []).forEach(patron => {
            for (const [res, req] of Object.entries(patron.requirements)) {
                const currentBonus = aiPlayer.bonuses[res] || 0;
                if (currentBonus < req) {
                    patronBonusDesirability[res] = (patronBonusDesirability[res] || 0) + (req - currentBonus);
                }
            }
        });

        // Tokens least needed (or color player has highest token surplus) are discarded first
        const tokenSurplus = Object.entries(aiPlayer.tokens)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .sort(([resA, countA], [resB, countB]) => {
                const needA = patronBonusDesirability[resA] || 0;
                const needB = patronBonusDesirability[resB] || 0;
                // Discard lowest need first, or highest count
                if (needA !== needB) return needA - needB;
                return countB - countA;
            });

        const tokensToDiscard = [];
        for (const [res, count] of tokenSurplus) {
            for (let i = 0; i < count && tokensToDiscard.length < excess; i++) {
                tokensToDiscard.push(res);
            }
            if (tokensToDiscard.length >= excess) break;
        }

        // Fallback if gold needed to discard
        if (tokensToDiscard.length < excess && aiPlayer.tokens['gold'] > 0) {
            tokensToDiscard.push('gold');
        }
        
        setTimeout(() => {
            try {
                this.discardTokens(tokensToDiscard);
            } catch (e) {
                this.needsToDiscard = false;
                this.advanceTurn();
            }
        }, 500);
    }

    advanceTurn() {
        if (this.isGameOver) return; 

        this.checkPatronVisits(); 
        
        if (this.getCurrentPlayer().prestige >= RULES.VICTORY_THRESHOLD) {
            this.isFinalRound = true;
        }
        
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        if (this.currentPlayerIndex === 0) {
            if (this.isFinalRound) {
                this.isGameOver = true;
                this.determineWinner();
                return;
            }
            this.turnNumber++;
        }

        this.checkAndTriggerAiIfNeeded();
    }

    checkAndTriggerAiIfNeeded() {
        if (this.isVsAi && !this.isGameOver && this.currentPlayerIndex !== 0) {
            this.triggerAiTurn();
        }
    }

    triggerAiTurn() {
        if (this.isAiPlaying || this.isGameOver || this.currentPlayerIndex === 0) return;
        this.isAiPlaying = true;

        setTimeout(() => {
            try {
                const ai = this.getCurrentPlayer();
                if (!ai) return;

                // 1. Gather all visible cards and reserved cards
                const allCards = [];
                for (let tier = 1; tier <= 3; tier++) {
                    (this.visibleMarket[tier] || []).forEach(card => {
                        allCards.push({ card, tier, isReserved: false });
                    });
                }
                (ai.reservedCards || []).forEach(card => {
                    allCards.push({ card, tier: card.tier, isReserved: true });
                });

                // 2. Identify Patron Needs
                const patronBonusDesirability = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
                (this.availablePatrons || []).forEach(patron => {
                    for (const [res, req] of Object.entries(patron.requirements)) {
                        const currentBonus = ai.bonuses[res] || 0;
                        if (currentBonus < req) {
                            const diff = req - currentBonus;
                            patronBonusDesirability[res] = (patronBonusDesirability[res] || 0) + (patron.points / (diff + 1)) * 3.0;
                        }
                    }
                });

                // 3. Strategic Card Evaluation
                const scoreCard = (card, tier) => {
                    let score = card.points * 8.0;

                    // Patron synergy
                    if (patronBonusDesirability[card.bonus]) {
                        score += patronBonusDesirability[card.bonus] * 2.5;
                    }

                    // Engine building value
                    score += (4 - tier) * 1.5;

                    // Endgame point urgency
                    if (ai.prestige >= 10 || this.isFinalRound) {
                        score += card.points * 18.0;
                    }

                    return score;
                };

                // 4. Find all Affordable Cards
                const affordableCards = [];
                allCards.forEach(item => {
                    try {
                        RuleEngine.calculateActualCost(ai, item.card.cost);
                        const score = scoreCard(item.card, item.tier);
                        
                        // Check if purchasing this card claims a patron
                        const simBonuses = { ...ai.bonuses, [item.card.bonus]: (ai.bonuses[item.card.bonus] || 0) + 1 };
                        const claimsPatron = (this.availablePatrons || []).some(p => {
                            return Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req);
                        });
                        
                        affordableCards.push({
                            ...item,
                            score: score + (claimsPatron ? 25.0 : 0)
                        });
                    } catch (e) {
                        // Not affordable
                    }
                });

                // OPTION A: Purchase best affordable card
                if (affordableCards.length > 0) {
                    affordableCards.sort((a, b) => b.score - a.score);
                    const bestToBuy = affordableCards[0];

                    if (bestToBuy.isReserved) {
                        this.purchaseReservedCard(bestToBuy.card.id);
                    } else {
                        this.purchaseVisibleCard(bestToBuy.tier, bestToBuy.card.id);
                    }
                    return;
                }

                // 5. If cannot buy, evaluate Top Target Cards to save for
                const targetCards = allCards
                    .filter(item => !item.isReserved)
                    .map(item => {
                        const score = scoreCard(item.card, item.tier);
                        let missingTokens = 0;
                        const neededByColor = {};
                        for (const [res, amt] of Object.entries(item.card.cost)) {
                            const haveBonus = ai.bonuses[res] || 0;
                            const haveTokens = ai.tokens[res] || 0;
                            const needed = Math.max(0, amt - haveBonus);
                            if (haveTokens < needed) {
                                const deficit = needed - haveTokens;
                                missingTokens += deficit;
                                neededByColor[res] = deficit;
                            }
                        }
                        const gold = ai.tokens[RESOURCES.GOLD] || 0;
                        missingTokens = Math.max(0, missingTokens - gold);

                        return {
                            ...item,
                            score: score / (missingTokens + 1),
                            missingTokens,
                            neededByColor
                        };
                    })
                    .sort((a, b) => b.score - a.score);

                const primaryTarget = targetCards[0];

                // OPTION B: Strategic Reservation (Snatch high point card & gold token or block opponent)
                const hasGoldInBank = (this.bank.tokens[RESOURCES.GOLD] || 0) > 0;
                const opponentIsThreat = this.players.some(p => p !== ai && p.prestige >= 10);
                
                if ((ai.reservedCards || []).length < 3 && hasGoldInBank && primaryTarget) {
                    if (primaryTarget.card.points >= 3 || (opponentIsThreat && primaryTarget.card.points >= 2)) {
                        this.reserveVisibleCard(primaryTarget.tier, primaryTarget.card.id);
                        return;
                    }
                }

                // OPTION C: Targeted Token Collection
                if (primaryTarget && primaryTarget.neededByColor) {
                    const neededColors = Object.keys(primaryTarget.neededByColor);

                    // Try taking 2 of a needed color if 4+ in bank
                    for (const color of neededColors) {
                        if (this.bank.hasTokens(color, 4) && primaryTarget.neededByColor[color] >= 2) {
                            this.takeTwoResources(color);
                            return;
                        }
                    }

                    // Take 3 different needed colors from bank
                    const availableNeeded = neededColors.filter(c => this.bank.hasTokens(c, 1));
                    
                    const allAvailable = Object.entries(this.bank.tokens)
                        .filter(([res, count]) => res !== 'gold' && count > 0)
                        .map(([res]) => res)
                        .sort((a, b) => (patronBonusDesirability[b] || 0) - (patronBonusDesirability[a] || 0));

                    const toTake = [...availableNeeded];
                    for (const color of allAvailable) {
                        if (toTake.length >= 3) break;
                        if (!toTake.includes(color)) toTake.push(color);
                    }

                    if (toTake.length > 0) {
                        const currentTotal = ai.getTotalTokenCount();
                        let takeCount = Math.min(toTake.length, 3);
                        if (currentTotal + takeCount > 10 && takeCount > 1) {
                            takeCount = Math.max(1, 10 - currentTotal);
                        }
                        const finalTokens = toTake.slice(0, Math.min(takeCount, 3));
                        if (finalTokens.length > 0) {
                            this.takeDifferentResources(finalTokens);
                            return;
                        }
                    }
                }

                // Fallback token collection
                const fallbackAvailable = Object.entries(this.bank.tokens)
                    .filter(([res, count]) => res !== 'gold' && count > 0)
                    .map(([res]) => res);

                if (fallbackAvailable.length >= 3) {
                    this.takeDifferentResources(fallbackAvailable.slice(0, 3));
                } else if (fallbackAvailable.length > 0) {
                    this.takeDifferentResources(fallbackAvailable);
                } else {
                    this.advanceTurn();
                }
            } catch (err) {
                console.error("AI Turn Error:", err);
                this.advanceTurn();
            } finally {
                this.isAiPlaying = false;
                if (window.gameUI) window.gameUI.renderAll();
                this.checkAndTriggerAiIfNeeded();
            }
        }, 700);
    }

    determineWinner() {
        this.players.sort((a, b) => {
            if (b.prestige !== a.prestige) return b.prestige - a.prestige;
            return a.purchasedCards.length - b.purchasedCards.length; 
        });
    }

    takeDifferentResources(resources) {
        if (this.isGameOver) throw new Error("The game is already over.");
        RuleEngine.validateTakeDifferent(this.bank, resources);
        
        const player = this.getCurrentPlayer();
        this.lastTokenSnapshot = {
            bank: { ...this.bank.tokens },
            playerTokens: { ...player.tokens }
        };

        resources.forEach(res => {
            this.bank.remove(res, 1);
            player.addToken(res, 1);
        });
        
        this.checkEndTurn(); 
    }

    takeTwoResources(res) {
        if (this.isGameOver) throw new Error("The game is already over.");
        RuleEngine.validateTakeTwo(this.bank, res);
        const player = this.getCurrentPlayer();
        this.lastTokenSnapshot = {
            bank: { ...this.bank.tokens },
            playerTokens: { ...player.tokens }
        };

        this.bank.remove(res, 2);
        player.addToken(res, 2);
        this.checkEndTurn();
    }

    cancelLastTokenAction() {
        if (!this.lastTokenSnapshot) return;
        const player = this.getCurrentPlayer();
        this.bank.tokens = { ...this.lastTokenSnapshot.bank };
        player.tokens = { ...this.lastTokenSnapshot.playerTokens };
        this.needsToDiscard = false;
        this.lastTokenSnapshot = null;
    }

    purchaseVisibleCard(tier, cardId) {
        if (this.isGameOver) throw new Error("The game is already over.");
        const marketArray = this.visibleMarket[tier];
        const cardIndex = marketArray.findIndex(c => c.id === cardId);
        if (cardIndex === -1) throw new Error("Card not found in the visible market.");

        const card = marketArray[cardIndex];
        const player = this.getCurrentPlayer();
        const paymentRequired = RuleEngine.getPaymentBreakdown(player, card.cost);

        for (const [resource, amount] of Object.entries(paymentRequired)) {
            player.removeToken(resource, amount);
            this.bank.add(resource, amount);
        }

        player.purchasedCards.push(card);
        player.prestige += card.points;
        player.bonuses[card.bonus] += 1;

        marketArray.splice(cardIndex, 1);
        const replacementCard = this.decks[tier].draw();
        if (replacementCard) marketArray.push(replacementCard);

        this.checkEndTurn();
    }

    reserveVisibleCard(tier, cardId) {
        if (this.isGameOver) throw new Error("The game is already over.");
        const player = this.getCurrentPlayer();
        RuleEngine.validateReservation(player);

        const marketArray = this.visibleMarket[tier];
        const cardIndex = marketArray.findIndex(c => c.id === cardId);
        if (cardIndex === -1) throw new Error("Card not found in the visible market.");

        const card = marketArray[cardIndex];
        player.reservedCards.push(card);
        marketArray.splice(cardIndex, 1);

        if (this.bank.hasTokens(RESOURCES.GOLD, 1)) {
            this.bank.remove(RESOURCES.GOLD, 1);
            player.addToken(RESOURCES.GOLD, 1);
        }

        const replacementCard = this.decks[tier].draw();
        if (replacementCard) marketArray.push(replacementCard);

        this.checkEndTurn();
    }

    purchaseReservedCard(cardId) {
        if (this.isGameOver) throw new Error("The game is already over.");
        const player = this.getCurrentPlayer();
        const cardIndex = player.reservedCards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) throw new Error("Card not found in your reserved cards.");

        const card = player.reservedCards[cardIndex];
        const paymentRequired = RuleEngine.getPaymentBreakdown(player, card.cost);

        for (const [resource, amount] of Object.entries(paymentRequired)) {
            player.removeToken(resource, amount);
            this.bank.add(resource, amount);
        }

        player.purchasedCards.push(card);
        player.prestige += card.points;
        player.bonuses[card.bonus] += 1;
        player.reservedCards.splice(cardIndex, 1);

        this.checkEndTurn();
    }

    discardTokens(tokensToDiscard) {
        const player = this.getCurrentPlayer();
        RuleEngine.validateDiscard(player, tokensToDiscard);
        
        tokensToDiscard.forEach(res => {
            player.removeToken(res, 1);
            this.bank.add(res, 1);
        });

        this.needsToDiscard = false;
        this.advanceTurn(); 
    }
}