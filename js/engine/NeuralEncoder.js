import { RESOURCES, RULES } from './constants.js';

export class NeuralEncoder {
    static RESOURCE_KEYS = ['ruby', 'sapphire', 'emerald', 'onyx', 'pearl'];

    /**
     * Encodes a game state and active player perspective into a 1D Float32Array tensor
     * @param {GameState} game 
     * @param {Player} player 
     * @returns {Float32Array}
     */
    static encodeState(game, player) {
        // Feature vector size: ~180 floats
        const features = [];

        // 1. Current Player Tokens (6 floats, normalized by 10)
        this.RESOURCE_KEYS.forEach(res => {
            features.push((player.tokens[res] || 0) / 10.0);
        });
        features.push((player.tokens[RESOURCES.GOLD] || 0) / 5.0);

        // 2. Current Player Bonuses/Discounts (5 floats, normalized by 8)
        this.RESOURCE_KEYS.forEach(res => {
            features.push((player.bonuses[res] || 0) / 8.0);
        });

        // 3. Current Player Prestige & Card Counts (2 floats)
        features.push(player.prestige / 15.0);
        features.push(player.purchasedCards.length / 20.0);

        // 4. Opponent Features (up to 3 opponents, 13 floats each = 39 floats)
        const opponents = game.players.filter(p => p !== player);
        for (let i = 0; i < 3; i++) {
            const opp = opponents[i];
            if (opp) {
                this.RESOURCE_KEYS.forEach(res => features.push((opp.tokens[res] || 0) / 10.0));
                features.push((opp.tokens[RESOURCES.GOLD] || 0) / 5.0);
                this.RESOURCE_KEYS.forEach(res => features.push((opp.bonuses[res] || 0) / 8.0));
                features.push(opp.prestige / 15.0);
            } else {
                for (let k = 0; k < 12; k++) features.push(0.0);
            }
        }

        // 5. Visible Market Cards (Tier 1: 4 cards, Tier 2: 4 cards, Tier 3: 4 cards = 12 cards * 7 floats = 84 floats)
        for (let tier = 1; tier <= 3; tier++) {
            const market = game.visibleMarket[tier] || [];
            for (let c = 0; c < 4; c++) {
                const card = market[c];
                if (card) {
                    this.RESOURCE_KEYS.forEach(res => features.push((card.cost[res] || 0) / 7.0));
                    features.push(card.points / 5.0);
                    features.push((this.RESOURCE_KEYS.indexOf(card.bonus) + 1) / 5.0);
                } else {
                    for (let k = 0; k < 7; k++) features.push(0.0);
                }
            }
        }

        // 6. Bank Tokens (6 floats, normalized by 7)
        this.RESOURCE_KEYS.forEach(res => {
            features.push((game.bank.tokens[res] || 0) / 7.0);
        });
        features.push((game.bank.tokens[RESOURCES.GOLD] || 0) / 5.0);

        // 7. Available Patrons (5 patrons * 6 floats = 30 floats)
        const patrons = game.availablePatrons || [];
        for (let p = 0; p < 5; p++) {
            const patron = patrons[p];
            if (patron) {
                this.RESOURCE_KEYS.forEach(res => features.push((patron.requirements[res] || 0) / 4.0));
                features.push(patron.points / 3.0);
            } else {
                for (let k = 0; k < 6; k++) features.push(0.0);
            }
        }

        // 8. Reserved Cards (3 cards * 7 floats = 21 floats)
        const reserved = player.reservedCards || [];
        for (let r = 0; r < 3; r++) {
            const card = reserved[r];
            if (card) {
                this.RESOURCE_KEYS.forEach(res => features.push((card.cost[res] || 0) / 7.0));
                features.push(card.points / 5.0);
                features.push((this.RESOURCE_KEYS.indexOf(card.bonus) + 1) / 5.0);
            } else {
                for (let k = 0; k < 7; k++) features.push(0.0);
            }
        }

        return new Float32Array(features);
    }
}
