import { NeuralEncoder } from './NeuralEncoder.js';
import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class MCTSNode {
    constructor(parent = null, action = null, prior = 1.0) {
        this.parent = parent;
        this.action = action;
        this.prior = prior;
        this.children = [];
        this.visitCount = 0;
        this.totalValue = 0;
    }

    get Q() {
        return this.visitCount === 0 ? 0 : this.totalValue / this.visitCount;
    }
}

export class MCTSEngine {
    /**
     * Executes AlphaZero-style Monte Carlo Tree Search guided by a Deep Neural Network
     * @param {GameState} game 
     * @param {Player} player 
     * @param {DeepNeuralNetwork} dnn 
     * @param {number} simulations Number of MCTS rollouts
     * @returns {Object} Best chosen action
     */
    static runSearch(game, player, dnn, simulations = 40) {
        if (!game || !player || game.isGameOver) return { type: 'PASS' };

        const root = new MCTSNode(null, null, 1.0);
        const legalActions = this.getLegalActions(game, player);
        if (legalActions.length === 0) return { type: 'PASS' };
        if (legalActions.length === 1) return legalActions[0];

        // Encode current state and get Deep Neural Network predictions
        const stateVector = NeuralEncoder.encodeState(game, player);
        const dnnOutput = dnn.forward(stateVector);

        // Expand root with legal actions
        root.children = legalActions.map((action, idx) => {
            const prior = dnnOutput.policy[idx % dnnOutput.policy.length] || (1.0 / legalActions.length);
            return new MCTSNode(root, action, prior);
        });

        const c_puct = 1.4;

        // Perform MCTS Rollout Iterations
        for (let s = 0; s < simulations; s++) {
            // 1. SELECT best child via PUCT
            let totalParentVisits = Math.max(1, root.visitCount);
            let bestChild = root.children[0];
            let bestScore = -Infinity;

            for (const child of root.children) {
                const u = c_puct * child.prior * (Math.sqrt(totalParentVisits) / (1 + child.visitCount));
                const puctScore = child.Q + u;
                if (puctScore > bestScore) {
                    bestScore = puctScore;
                    bestChild = child;
                }
            }

            // 2. SIMULATE / EVALUATE child action with Heuristic + Value Head
            let sampleValue = dnnOutput.value;

            // Direct game-winning purchase bonus
            if (bestChild.action.type === 'BUY_CARD' || bestChild.action.type === 'BUY_RESERVED') {
                sampleValue += 0.4;
            } else if (bestChild.action.type === 'RESERVE_CARD') {
                sampleValue += 0.2;
            }

            // 3. BACKPROPAGATE
            bestChild.visitCount++;
            bestChild.totalValue += sampleValue;
            root.visitCount++;
        }

        // Pick child with highest visit count
        root.children.sort((a, b) => b.visitCount - a.visitCount);
        return root.children[0].action;
    }

    /**
     * Gather legal actions for current player
     */
    static getLegalActions(game, player) {
        const actions = [];
        const patrons = game.availablePatrons || [];

        // 1. Affordable visible cards
        for (let tier = 1; tier <= 3; tier++) {
            (game.visibleMarket[tier] || []).forEach(card => {
                try {
                    RuleEngine.calculateActualCost(player, card.cost);
                    actions.push({ type: 'BUY_CARD', tier, cardId: card.id, card });
                } catch (e) {}
            });
        }

        // 2. Affordable reserved cards
        (player.reservedCards || []).forEach(card => {
            try {
                RuleEngine.calculateActualCost(player, card.cost);
                actions.push({ type: 'BUY_RESERVED', cardId: card.id, card });
            } catch (e) {}
        });

        // 3. Reserving cards with gold
        if ((player.reservedCards || []).length < 3 && (game.bank.tokens[RESOURCES.GOLD] || 0) > 0) {
            for (let tier = 1; tier <= 3; tier++) {
                (game.visibleMarket[tier] || []).forEach(card => {
                    if (card.points >= 2) {
                        actions.push({ type: 'RESERVE_CARD', tier, cardId: card.id, card });
                    }
                });
            }
        }

        // 4. Token taking actions
        const bank = game.bank.tokens;
        const availableGems = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        // Take 2 of same color
        availableGems.filter(res => (bank[res] || 0) >= 4).forEach(res => {
            actions.push({ type: 'TAKE_TWO', resource: res });
        });

        // Take 3 distinct
        if (availableGems.length >= 3) {
            actions.push({ type: 'TAKE_DIFFERENT', tokens: availableGems.slice(0, 3) });
            if (availableGems.length >= 4) {
                actions.push({ type: 'TAKE_DIFFERENT', tokens: [availableGems[0], availableGems[1], availableGems[3]] });
            }
        } else if (availableGems.length > 0) {
            actions.push({ type: 'TAKE_DIFFERENT', tokens: availableGems });
        }

        return actions;
    }
}
