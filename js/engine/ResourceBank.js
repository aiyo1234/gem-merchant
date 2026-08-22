import { RESOURCES, NORMAL_RESOURCES } from './constants.js';

export class ResourceBank {
    constructor() {
        this.tokens = {
            [RESOURCES.RUBY]: 0,
            [RESOURCES.SAPPHIRE]: 0,
            [RESOURCES.EMERALD]: 0,
            [RESOURCES.ONYX]: 0,
            [RESOURCES.PEARL]: 0,
            [RESOURCES.GOLD]: 0
        };
    }

    initialize(playerCount) {
        const standardTokenCount = playerCount === 2 ? 4 : (playerCount === 3 ? 5 : 7);
        
        NORMAL_RESOURCES.forEach(res => {
            this.tokens[res] = standardTokenCount;
        });
        this.tokens[RESOURCES.GOLD] = 5; 
    }

    hasTokens(type, amount = 1) {
        return this.tokens[type] >= amount;
    }

    add(type, amount) {
        this.tokens[type] += amount;
    }

    remove(type, amount) {
        if (!this.hasTokens(type, amount)) {
            throw new Error(`Bank has insufficient ${type} tokens.`);
        }
        this.tokens[type] -= amount;
    }
}
