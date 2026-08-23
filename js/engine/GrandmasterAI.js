import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';
import { DeepNeuralNetwork } from './DeepNeuralNetwork.js';
import { MCTSEngine } from './MCTSEngine.js';
import { MCTS_DNN_WEIGHTS } from './mcts_weights_data.js';

export class GrandmasterAI {
    // 90-Minute 8-Core Evolutionary Supreme Champion Genome (1,612,800 Matches Evaluated)
    static DEFAULT_WEIGHTS = {
        pointWeight: 455.0,
        cardPointWeight: 185.0,
        patronRewardWeight: 347.75,
        focusSynergyWeight: 115.0,
        tokenCostPenalty: 15.0,
        freeCardWeight: 61.22,
        denialSensitivity: 10.31,
        tokenFlushThreshold: 8
    };

    /**
     * Compute best action using 90-Minute 8-Core Supreme Champion Algorithm
     */
    static computeBestAction(game, aiPlayer) {
        try {
            return this.computeBestActionWithWeights(game, aiPlayer, this.DEFAULT_WEIGHTS);
        } catch (e) {
            return { type: 'PASS' };
        }
    }

    /**
     * Compute action using customizable weight genome for self-play training & evolution
     * @param {GameState} game 
     * @param {Player} aiPlayer 
     * @param {Object} w Custom weights
     * @returns {Object} Action descriptor
     */
    static computeBestActionWithWeights(game, aiPlayer, w = this.DEFAULT_WEIGHTS) {
        if (!game || !aiPlayer || game.isGameOver) return { type: 'PASS' };

        const weights = { ...this.DEFAULT_WEIGHTS, ...w };
        const bank = game.bank.tokens;
        const patrons = game.availablePatrons || [];
        const opponents = game.players.filter(p => p !== aiPlayer);
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        const bankHasGold = (bank[RESOURCES.GOLD] || 0) > 0;

        // ==============================================================
        // 1. OPPONENT THREAT MODELING & ACTIVE DENIAL (Hate-Drafting)
        // ==============================================================
        let criticalDenialCard = null;
        for (const opp of opponents) {
            const oppPrestige = opp.prestige || 0;
            for (let tier = 1; tier <= 3; tier++) {
                const market = game.visibleMarket[tier] || [];
                for (const card of market) {
                    try {
                        RuleEngine.calculateActualCost(opp, card.cost);
                        const simBonuses = { ...opp.bonuses, [card.bonus]: (opp.bonuses[card.bonus] || 0) + 1 };
                        let extraPatronPts = 0;
                        patrons.forEach(p => {
                            if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                                extraPatronPts += p.points;
                            }
                        });
                        const projectedPrestige = oppPrestige + card.points + extraPatronPts;
                        if (projectedPrestige >= RULES.VICTORY_THRESHOLD) {
                            criticalDenialCard = { card, tier, priority: 100 };
                            break;
                        }
                    } catch (e) {}
                }
                if (criticalDenialCard && criticalDenialCard.priority === 100) break;
            }
            if (criticalDenialCard && criticalDenialCard.priority === 100) break;
        }

        // Emergency Denial: Save the game if opponent is about to win next turn
        if (criticalDenialCard && criticalDenialCard.priority === 100 && canReserve) {
            return {
                type: 'RESERVE_CARD',
                tier: criticalDenialCard.tier,
                cardId: criticalDenialCard.card.id
            };
        }

        // ==============================================================
        // 2. ORTHOGONAL LANE MODELING & PATRON PATHFINDING
        // ==============================================================
        const oppPressure = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        opponents.forEach(opp => {
            for (const [r, count] of Object.entries(opp.tokens || {})) oppPressure[r] = (oppPressure[r] || 0) + count;
            for (const [r, count] of Object.entries(opp.bonuses || {})) oppPressure[r] = (oppPressure[r] || 0) + count * 2;
        });

        const laneScores = {};
        ['ruby', 'sapphire', 'emerald', 'pearl', 'onyx'].forEach(res => {
            const bankCount = bank[res] || 0;
            const myBonus = aiPlayer.bonuses[res] || 0;
            const pressure = oppPressure[res] || 0;
            laneScores[res] = (bankCount * 2.0) + (myBonus * 6.0) - (pressure * (weights.denialSensitivity || 10.3));
        });
        const sortedLanes = Object.entries(laneScores).sort((a, b) => b[1] - a[1]);
        const bestColor1 = sortedLanes[0] ? sortedLanes[0][0] : 'ruby';
        const bestColor2 = sortedLanes[1] ? sortedLanes[1][0] : 'sapphire';

        // ==============================================================
        // 3. GATHER ALL VISIBLE & RESERVED CARDS
        // ==============================================================
        const allCards = [];
        for (let t = 3; t >= 1; t--) {
            (game.visibleMarket[t] || []).forEach(card => allCards.push({ card, tier: t, isReserved: false }));
        }
        (aiPlayer.reservedCards || []).forEach(card => allCards.push({ card, tier: card.tier, isReserved: true }));

        // ==============================================================
        // 4. EVALUATE AFFORDABLE PURCHASES (HIGH PRESTIGE FIRST)
        // ==============================================================
        const affordable = [];
        for (const item of allCards) {
            try {
                RuleEngine.calculateActualCost(aiPlayer, item.card.cost);

                const simBonuses = { ...aiPlayer.bonuses, [item.card.bonus]: (aiPlayer.bonuses[item.card.bonus] || 0) + 1 };
                let patronReward = 0;
                patrons.forEach(p => {
                    if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                        patronReward += p.points;
                    }
                });

                const totalPoints = item.card.points + patronReward;
                const wins = (aiPlayer.prestige + totalPoints) >= 15;

                let netTokens = 0;
                for (const [r, amt] of Object.entries(item.card.cost)) {
                    netTokens += Math.max(0, amt - (aiPlayer.bonuses[r] || 0));
                }

                const matchesFocus = (item.card.bonus === bestColor1 || item.card.bonus === bestColor2) ? 1 : 0;

                let score = (totalPoints * (weights.pointWeight || 455.0))
                    + (item.card.points * (weights.cardPointWeight || 185.0))
                    + (patronReward * (weights.patronRewardWeight || 347.75))
                    + (matchesFocus * (weights.focusSynergyWeight || 115.0))
                    - (netTokens * (weights.tokenCostPenalty || 15.0))
                    + (item.tier * 12.0);

                if (netTokens === 0) score += (weights.freeCardWeight || 61.22);

                affordable.push({ ...item, totalPoints, patronReward, netTokens, wins, score });
            } catch (e) {}
        }

        // TACTIC 1: IMMEDIATE WINNING PURCHASE (15+ Points)
        const winBuy = affordable.find(a => a.wins);
        if (winBuy) {
            return winBuy.isReserved ? { type: 'BUY_RESERVED', cardId: winBuy.card.id } : { type: 'BUY_CARD', tier: winBuy.tier, cardId: winBuy.card.id };
        }

        // TACTIC 2: BUY HIGH-PRESTIGE CARDS (>= 2 POINTS)
        const bigBuys = affordable.filter(a => a.totalPoints >= 2);
        if (bigBuys.length > 0) {
            bigBuys.sort((a, b) => b.score - a.score);
            const top = bigBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 3: BUY 1-POINT CARDS
        const oneBuys = affordable.filter(a => a.totalPoints >= 1);
        if (oneBuys.length > 0) {
            oneBuys.sort((a, b) => b.score - a.score);
            const top = oneBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 4: ZERO-COST FREE PURCHASES
        const freeBuys = affordable.filter(a => a.netTokens === 0 && (a.card.bonus === bestColor1 || a.card.bonus === bestColor2 || a.patronReward > 0));
        if (freeBuys.length > 0) {
            freeBuys.sort((a, b) => b.score - a.score);
            const top = freeBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 5: CHEAP ENGINE BUILDING (ONLY EARLY GAME < 4 DISCOUNTS)
        const cheapFocus = affordable.filter(a => a.tier === 1 && a.netTokens <= 2 && (a.card.bonus === bestColor1 || a.card.bonus === bestColor2) && (aiPlayer.bonuses[a.card.bonus] || 0) < 4);
        if (cheapFocus.length > 0 && aiPlayer.prestige < 4) {
            cheapFocus.sort((a, b) => b.score - a.score);
            const top = cheapFocus[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 6: ANTI-STALL TOKEN FLUSH (HOLDING 8+ TOKENS)
        if (affordable.length > 0 && aiPlayer.getTotalTokenCount() >= (weights.tokenFlushThreshold || 8)) {
            affordable.sort((a, b) => b.score - a.score);
            const top = affordable[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // ==============================================================
        // 5. TARGET SELECTION (PRIORITIZE HIGH-TIER SPRINT)
        // ==============================================================
        let target = null;
        if (aiPlayer.reservedCards && aiPlayer.reservedCards.length > 0) {
            const sortedRes = [...aiPlayer.reservedCards].sort((a, b) => b.points - a.points);
            target = { card: sortedRes[0], tier: sortedRes[0].tier, isReserved: true };
        }

        if (!target) {
            const visibleT3 = (game.visibleMarket[3] || []).filter(c => c.points >= 4);
            const focusT3 = visibleT3.filter(c => (c.cost[bestColor1] || 0) >= 3 || (c.cost[bestColor2] || 0) >= 3);
            if (focusT3.length > 0) target = { card: focusT3[0], tier: 3, isReserved: false };
            else if (visibleT3.length > 0) target = { card: visibleT3[0], tier: 3, isReserved: false };
            else {
                const visibleT2 = (game.visibleMarket[2] || []).filter(c => c.points >= 2);
                if (visibleT2.length > 0) target = { card: visibleT2[0], tier: 2, isReserved: false };
            }
        }

        // STRATEGIC GOLD WILDCARD RESERVATION (LOCK 4+ PT CARDS & GRAB GOLD)
        if (target && !target.isReserved && target.card.points >= 4 && canReserve && bankHasGold && aiPlayer.purchasedCards.length >= 1) {
            return { type: 'RESERVE_CARD', tier: target.tier, cardId: target.card.id };
        }

        // ==============================================================
        // 6. TOKEN DEFICIT OPTIMIZATION (MAX 3-TOKEN DIVERSE INFLOW)
        // ==============================================================
        const deficits = {};
        if (target) {
            for (const [r, amt] of Object.entries(target.card.cost)) {
                const need = Math.max(0, amt - (aiPlayer.bonuses[r] || 0));
                const have = aiPlayer.tokens[r] || 0;
                if (have < need) deficits[r] = need - have;
            }

            // Take 2 if deficit >= 2 and bank >= 4
            for (const [r, count] of Object.entries(deficits)) {
                if ((bank[r] || 0) >= 4 && count >= 2 && aiPlayer.getTotalTokenCount() <= 8) {
                    return { type: 'TAKE_TWO', resource: r };
                }
            }
        }

        if ((aiPlayer.bonuses[bestColor1] || 0) < 4) deficits[bestColor1] = (deficits[bestColor1] || 0) + 3;
        if ((aiPlayer.bonuses[bestColor2] || 0) < 4) deficits[bestColor2] = (deficits[bestColor2] || 0) + 2;

        const availableColors = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        const ranked = availableColors.sort((a, b) => (deficits[b] || 0) - (deficits[a] || 0));

        const curTokens = aiPlayer.getTotalTokenCount();
        if (ranked.length > 0 && curTokens < 10) {
            const takeN = Math.min(3, Math.min(10 - curTokens, ranked.length));
            if (takeN > 0) return { type: 'TAKE_DIFFERENT', tokens: ranked.slice(0, takeN) };
        }

        if (canReserve && bankHasGold) {
            const visibleT3 = game.visibleMarket[3] || [];
            if (visibleT3.length > 0) return { type: 'RESERVE_CARD', tier: 3, cardId: visibleT3[0].id };
        }

        if (affordable.length > 0) {
            affordable.sort((a, b) => b.score - a.score);
            const top = affordable[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        return { type: 'PASS' };
    }
}
