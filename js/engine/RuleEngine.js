import { RULES, RESOURCES } from './constants.js';

export class RuleEngine {
    static validateTakeDifferent(bank, resources) {
        if (!resources || resources.length === 0 || resources.length > 3) {
            throw new Error("You must select between 1 and 3 different token types.");
        }

        const uniqueRes = new Set(resources);
        if (uniqueRes.size !== resources.length) {
            throw new Error("You cannot select duplicate tokens when taking different colors.");
        }

        resources.forEach(res => {
            if (!bank.hasTokens(res, 1)) {
                throw new Error(`The bank does not have enough ${res} tokens.`);
            }
        });
    }

    static validateTakeTwo(bank, resource) {
        if (!bank.hasTokens(resource, 4)) {
            throw new Error(`To take 2 tokens of the same color, the bank must have at least 4 ${resource} tokens available.`);
        }
    }

    static calculateActualCost(player, cardCost) {
        const actualCost = {};
        for (const [resource, baseAmt] of Object.entries(cardCost)) {
            const discount = player.bonuses[resource] || 0;
            const remaining = Math.max(0, baseAmt - discount);
            if (remaining > 0) {
                actualCost[resource] = remaining;
            }
        }

        let totalMissing = 0;
        let availableGold = player.tokens[RESOURCES.GOLD] || 0;

        for (const [resource, amt] of Object.entries(actualCost)) {
            const playerTokens = player.tokens[resource] || 0;
            if (playerTokens < amt) {
                totalMissing += (amt - playerTokens);
            }
        }

        if (totalMissing > availableGold) {
            throw new Error("You do not have enough resources or wild gold to afford this card.");
        }

        return actualCost;
    }

    // Automatically computes exact tokens spent, using gold wildcards for any color deficits
    static getPaymentBreakdown(player, cardCost) {
        const actualCost = {};
        for (const [resource, baseAmt] of Object.entries(cardCost)) {
            const discount = player.bonuses[resource] || 0;
            const remaining = Math.max(0, baseAmt - discount);
            if (remaining > 0) {
                actualCost[resource] = remaining;
            }
        }

        const payment = {};
        let goldNeeded = 0;

        for (const [resource, amt] of Object.entries(actualCost)) {
            const playerTokens = player.tokens[resource] || 0;
            const paidFromColor = Math.min(playerTokens, amt);
            if (paidFromColor > 0) {
                payment[resource] = paidFromColor;
            }
            const deficit = amt - paidFromColor;
            if (deficit > 0) {
                goldNeeded += deficit;
            }
        }

        if (goldNeeded > 0) {
            payment[RESOURCES.GOLD] = goldNeeded;
        }

        return payment;
    }

    static validateReservation(player) {
        if (player.reservedCards.length >= 3) {
            throw new Error("You already have 3 reserved cards. You cannot hold more than 3 cards at the same time.");
        }
    }

    static validateDiscard(player, tokensToDiscard) {
        const totalTokens = player.getTotalTokenCount();
        const excess = totalTokens - RULES.MAX_PLAYER_TOKENS;
        if (excess <= 0) return;

        if (!tokensToDiscard || tokensToDiscard.length !== excess) {
            throw new Error(`You must discard exactly ${excess} token(s).`);
        }

        tokensToDiscard.forEach(res => {
            if ((player.tokens[res] || 0) <= 0) {
                throw new Error(`You do not have any ${res} tokens to discard.`);
            }
        });
    }

    static checkPatronQualification(player, patron) {
        for (const [res, requiredAmt] of Object.entries(patron.requirements)) {
            const playerBonus = player.bonuses[res] || 0;
            if (playerBonus < requiredAmt) {
                return false;
            }
        }
        return true;
    }
}