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

        let photoPool = [];
        const totalPhotos = 45;
        for (let i = 1; i <= totalPhotos; i++) {
            photoPool.push(i);
        }
        photoPool.sort(() => 0.5 - Math.random());
        let poolIndex = 0;

        allCardsData.forEach(data => {
            if (poolIndex >= photoPool.length) {
                photoPool.sort(() => 0.5 - Math.random());
                poolIndex = 0;
            }

            const assignedPhoto = photoPool[poolIndex++];
            const uniqueCardId = `${data.id}_${Math.random().toString(36).substr(2, 5)}`;

            const card = new Card(uniqueCardId, data.tier, data.points, data.bonus, data.cost);
            card.artIndex = assignedPhoto;
            cardsByTier[data.tier].push(card);
        });

        for (let tier = 1; tier <= 3; tier++) {
            cardsByTier[tier].sort(() => 0.5 - Math.random());
        }

        this.decks[1] = new Deck(1, cardsByTier[1]);
        this.decks[2] = new Deck(2, cardsByTier[2]);
        this.decks[3] = new Deck(3, cardsByTier[3]);
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
        const tokensToDiscard = [];
        
        for (const [res, count] of Object.entries(aiPlayer.tokens)) {
            for (let i = 0; i < count && tokensToDiscard.length < excess; i++) {
                tokensToDiscard.push(res);
            }
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
                const aiPlayer = this.getCurrentPlayer();
                let purchased = false;

                for (let tier = 3; tier >= 1; tier--) {
                    const market = this.visibleMarket[tier];
                    for (let i = 0; i < market.length; i++) {
                        const card = market[i];
                        try {
                            RuleEngine.calculateActualCost(aiPlayer, card.cost);
                            this.purchaseVisibleCard(tier, card.id);
                            purchased = true;
                            break;
                        } catch (e) {
                            // Can't afford
                        }
                    }
                    if (purchased) break;
                }

                if (!purchased) {
                    const availableRes = Object.entries(this.bank.tokens)
                        .filter(([res, count]) => res !== 'gold' && count > 0)
                        .map(([res]) => res);

                    const fourPlusRes = Object.entries(this.bank.tokens)
                        .filter(([res, count]) => res !== 'gold' && count >= 4)
                        .map(([res]) => res);

                    if (fourPlusRes.length > 0 && Math.random() > 0.5) {
                        this.takeTwoResources(fourPlusRes[0]);
                    } else if (availableRes.length >= 2) {
                        this.takeDifferentResources([availableRes[0], availableRes[1]]);
                    } else if (availableRes.length === 1) {
                        this.takeTwoResources(availableRes[0]);
                    } else {
                        this.advanceTurn();
                    }
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
        this.bank.remove(res, 2);
        player.addToken(res, 2);
        this.checkEndTurn();
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