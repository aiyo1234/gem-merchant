import { RESOURCES } from './constants.js';

export class Player {
    constructor(name, isBot = false) {
        this.name = name;
        this.isBot = isBot || (typeof name === 'string' && (name.toLowerCase().includes('bot') || name.toLowerCase().includes('ai')));
        this.tokens = {
            [RESOURCES.RUBY]: 0,
            [RESOURCES.SAPPHIRE]: 0,
            [RESOURCES.EMERALD]: 0,
            [RESOURCES.ONYX]: 0,
            [RESOURCES.PEARL]: 0,
            [RESOURCES.GOLD]: 0
        };
        this.bonuses = {
            [RESOURCES.RUBY]: 0,
            [RESOURCES.SAPPHIRE]: 0,
            [RESOURCES.EMERALD]: 0,
            [RESOURCES.ONYX]: 0,
            [RESOURCES.PEARL]: 0
        };
        this.purchasedCards = [];
        this.reservedCards = [];
        this.patrons = [];
        this.prestige = 0;
    }

    addToken(resource, amount) {
        this.tokens[resource] = (this.tokens[resource] || 0) + amount;
    }

    removeToken(resource, amount) {
        const currentAmount = this.tokens[resource] || 0;
        if (currentAmount >= amount) {
            this.tokens[resource] -= amount;
        } else {
            // Spend whatever available of the specific color, and cover the rest using Gold wild tokens
            const deficit = amount - currentAmount;
            this.tokens[resource] = 0;
            
            const availableGold = this.tokens[RESOURCES.GOLD] || 0;
            if (availableGold < deficit) {
                throw new Error(`Player ${this.name} has insufficient ${resource} tokens and not enough wild gold.`);
            }
            this.tokens[RESOURCES.GOLD] -= deficit;
        }
    }

    getTotalTokenCount() {
        return Object.values(this.tokens).reduce((sum, count) => sum + count, 0);
    }
}