import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';
import { DeepNeuralNetwork } from './DeepNeuralNetwork.js';
import { MCTSEngine } from './MCTSEngine.js';
import { MCTS_DNN_WEIGHTS } from './mcts_weights_data.js';

export class GrandmasterAI {
    // Evolved Hyper-Rush Champion Genome Weights (Fastest Win = 18 Rounds)
    static DEFAULT_WEIGHTS = {
        pointMultiplier: 77.32,
        freeCardBonus: 15.0,
        oneTokenBonus: 6.0,
        twoTokenBonus: 8.0,
        threeTokenBonus: 18.43,
        tier3Bonus: 95.0,
        tier2Bonus: 45.0,
        marketDemandMultiplier: 0.2,
        patronSynergyMultiplier: 31.57,
        denialUrgency: 35.0,
        goldReservationThreshold: 1.0,
        directPointPriority: 100.0
    };

    static dnnInstance = null;

    static getDNN() {
        if (!this.dnnInstance) {
            this.dnnInstance = new DeepNeuralNetwork(193, 64, 32, 16);
            if (MCTS_DNN_WEIGHTS) {
                this.dnnInstance.importWeights(MCTS_DNN_WEIGHTS);
            }
        }
        return this.dnnInstance;
    }

    /**
     * Compute best action using Deep Neural Network MCTS + Evolved Snowball heuristics
     */
    static computeBestAction(game, aiPlayer) {
        try {
            // First check heuristic for instant tactical decisions (Winning moves, Free 0-cost cards, Denial)
            const heuristicAction = this.computeBestActionWithWeights(game, aiPlayer, this.DEFAULT_WEIGHTS);
            
            // If heuristic identifies a critical purchase or urgent denial, execute immediately
            if (heuristicAction.type === 'BUY_CARD' || heuristicAction.type === 'BUY_RESERVED') {
                return heuristicAction;
            }

            // Run Deep Neural Network Guided Monte Carlo Tree Search
            const dnn = this.getDNN();
            const mctsAction = MCTSEngine.runSearch(game, aiPlayer, dnn, 30);
            if (mctsAction && mctsAction.type !== 'PASS') {
                return mctsAction;
            }

            return heuristicAction;
        } catch (e) {
            return this.computeBestActionWithWeights(game, aiPlayer, this.DEFAULT_WEIGHTS);
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
        const patrons = game.availablePatrons || [];
        const opponents = game.players.filter(p => p !== aiPlayer);
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        const bankHasGold = (game.bank.tokens[RESOURCES.GOLD] || 0) > 0;

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
                            const qualifies = Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req);
                            if (qualifies) extraPatronPts += p.points;
                        });

                        const projectedPrestige = oppPrestige + card.points + extraPatronPts;
                        if (projectedPrestige >= RULES.VICTORY_THRESHOLD) {
                            criticalDenialCard = { card, tier, priority: 100 };
                            break;
                        } else if (card.points >= 3 && oppPrestige >= 10) {
                            criticalDenialCard = { card, tier, priority: weights.denialUrgency };
                        }
                    } catch (e) {
                        // Opponent cannot afford
                    }
                }
                if (criticalDenialCard && criticalDenialCard.priority === 100) break;
            }
            if (criticalDenialCard && criticalDenialCard.priority === 100) break;
        }

        // TACTIC: If opponent will win on their next turn, RESERVE their card to save the game!
        if (criticalDenialCard && criticalDenialCard.priority === 100 && canReserve) {
            return {
                type: 'RESERVE_CARD',
                tier: criticalDenialCard.tier,
                cardId: criticalDenialCard.card.id
            };
        }

        // ==============================================================
        // 2. GATHER ALL CARDS (MARKET + RESERVED)
        // ==============================================================
        const allVisibleAndReserved = [];
        for (let tier = 1; tier <= 3; tier++) {
            (game.visibleMarket[tier] || []).forEach(card => {
                allVisibleAndReserved.push({ card, tier, isReserved: false });
            });
        }
        (aiPlayer.reservedCards || []).forEach(card => {
            allVisibleAndReserved.push({ card, tier: card.tier, isReserved: true });
        });

        // ==============================================================
        // 3. NOBLE PATRON PATHFINDING & DEMAND ANALYSIS
        // ==============================================================
        const patronDesirability = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        patrons.forEach(patron => {
            let missingForPatron = 0;
            for (const [res, req] of Object.entries(patron.requirements)) {
                const have = aiPlayer.bonuses[res] || 0;
                if (have < req) {
                    const diff = req - have;
                    missingForPatron += diff;
                    patronDesirability[res] = (patronDesirability[res] || 0) + (patron.points / (diff + 1)) * (weights.patronSynergyMultiplier * 1.5);
                }
            }
        });

        const marketBonusDemand = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        for (let t = 2; t <= 3; t++) {
            (game.visibleMarket[t] || []).forEach(c => {
                for (const [res, amt] of Object.entries(c.cost || {})) {
                    marketBonusDemand[res] = (marketBonusDemand[res] || 0) + amt;
                }
            });
        }

        // ==============================================================
        // 4. CARD EVALUATION FUNCTION (LOW TOKEN COST = HIGH TEMPO)
        // ==============================================================
        const evaluateCardForPurchase = (item) => {
            const { card, tier } = item;
            
            let netTokenCost = 0;
            for (const [res, amt] of Object.entries(card.cost || {})) {
                const discount = aiPlayer.bonuses[res] || 0;
                netTokenCost += Math.max(0, amt - discount);
            }

            const simBonuses = { ...aiPlayer.bonuses, [card.bonus]: (aiPlayer.bonuses[card.bonus] || 0) + 1 };
            let patronReward = 0;
            patrons.forEach(p => {
                if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                    patronReward += p.points;
                }
            });

            const totalPointsGained = card.points + patronReward;
            const winsGame = (aiPlayer.prestige + totalPointsGained) >= RULES.VICTORY_THRESHOLD;

            let score = 0;
            // Overwhelming point weighting for hyper-rush to 15 points
            score += totalPointsGained * (weights.pointMultiplier || 80.0);

            if (netTokenCost === 0) {
                score += (weights.freeCardBonus || 20.0);
            } else if (netTokenCost === 1) {
                score += (weights.oneTokenBonus || 10.0);
            } else if (netTokenCost === 2) {
                score += (weights.twoTokenBonus || 8.0);
            } else if (netTokenCost === 3) {
                score += (weights.threeTokenBonus || 5.0);
            }

            if (card.points >= 4) score += (weights.tier3Bonus || 90.0);
            else if (card.points >= 3) score += (weights.tier3Bonus || 90.0) * 0.7;
            else if (card.points >= 2) score += (weights.tier3Bonus || 90.0) * 0.4;
            else if (card.points >= 1) score += (weights.tier3Bonus || 90.0) * 0.2;

            score += (marketBonusDemand[card.bonus] || 0) * (weights.marketDemandMultiplier || 0.5);
            score += (patronDesirability[card.bonus] || 0) * (weights.patronSynergyMultiplier || 10.0);

            const efficiency = (score + 10.0) / (netTokenCost + 1.0);

            return {
                netTokenCost,
                totalPointsGained,
                patronReward,
                winsGame,
                score,
                efficiency
            };
        };

        // ==============================================================
        // 5. EVALUATE AFFORDABLE PURCHASES (HIGH PRESTIGE FIRST)
        // ==============================================================
        const affordablePurchases = [];
        for (const item of allVisibleAndReserved) {
            try {
                RuleEngine.calculateActualCost(aiPlayer, item.card.cost);
                const evalData = evaluateCardForPurchase(item);

                // Never spend precious Gold tokens on 0-point cards unless it immediately triggers a Noble Patron!
                let goldNeeded = 0;
                for (const [res, amt] of Object.entries(item.card.cost)) {
                    const discount = aiPlayer.bonuses[res] || 0;
                    const rem = Math.max(0, amt - discount);
                    const have = aiPlayer.tokens[res] || 0;
                    if (have < rem) goldNeeded += (rem - have);
                }
                if (evalData.totalPointsGained === 0 && goldNeeded > 0) {
                    continue; // Do not waste precious Gold on 0-point cards!
                }

                affordablePurchases.push({
                    ...item,
                    ...evalData
                });
            } catch (e) {
                // Not affordable
            }
        }

        // TACTIC 1: IMMEDIATE WINNING PURCHASE (15+ Points)
        const winningBuy = affordablePurchases.find(p => p.winsGame);
        if (winningBuy) {
            return winningBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: winningBuy.card.id }
                : { type: 'BUY_CARD', tier: winningBuy.tier, cardId: winningBuy.card.id };
        }

        // TACTIC 2: BUY AFFORDABLE RESERVED CARDS (THEY HOLD SECURED POINTS)
        const affordableReserved = affordablePurchases.filter(p => p.isReserved && p.totalPointsGained > 0);
        if (affordableReserved.length > 0) {
            affordableReserved.sort((a, b) => b.totalPointsGained - a.totalPointsGained || b.score - a.score);
            return { type: 'BUY_RESERVED', cardId: affordableReserved[0].card.id };
        }

        // TACTIC 3: BUY ANY AFFORDABLE CARD WITH 2+ PRESTIGE POINTS (RUSH TO 15)
        const highPointBuys = affordablePurchases.filter(p => p.totalPointsGained >= 2);
        if (highPointBuys.length > 0) {
            highPointBuys.sort((a, b) => b.totalPointsGained - a.totalPointsGained || b.score - a.score);
            const topBuy = highPointBuys[0];
            return topBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: topBuy.card.id }
                : { type: 'BUY_CARD', tier: topBuy.tier, cardId: topBuy.card.id };
        }

        // TACTIC 4: BUY 1-POINT CARDS IF AFFORDABLE
        const onePointBuys = affordablePurchases.filter(p => p.totalPointsGained >= 1);
        if (onePointBuys.length > 0) {
            onePointBuys.sort((a, b) => b.score - a.score);
            const topBuy = onePointBuys[0];
            return topBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: topBuy.card.id }
                : { type: 'BUY_CARD', tier: topBuy.tier, cardId: topBuy.card.id };
        }

        const totalTier1Cards = aiPlayer.purchasedCards.filter(c => c.tier === 1).length;

        // TACTIC 5: ZERO-COST "FREE" PURCHASES (ONLY IF IT GIVES POINTS OR IN EARLY ENGINE BUILDING)
        const freePurchases = affordablePurchases.filter(p => p.netTokenCost === 0);
        if (freePurchases.length > 0) {
            // Filter out 0-point free cards if we already have 5+ Tier 1 cards (do not waste turns!)
            const worthyFree = freePurchases.filter(p => p.totalPointsGained > 0 || totalTier1Cards < 5 || aiPlayer.getTotalTokenCount() >= 9);
            if (worthyFree.length > 0) {
                worthyFree.sort((a, b) => b.totalPointsGained - a.totalPointsGained || b.score - a.score);
                const bestFree = worthyFree[0];
                return bestFree.isReserved
                    ? { type: 'BUY_RESERVED', cardId: bestFree.card.id }
                    : { type: 'BUY_CARD', tier: bestFree.tier, cardId: bestFree.card.id };
            }
        }

        // TACTIC 6: IF PLAYER IS HOLDING 8+ TOKENS, FORCE BEST AFFORDABLE PURCHASE (PREVENT TOKEN STALL)
        if (affordablePurchases.length > 0 && aiPlayer.getTotalTokenCount() >= 8) {
            affordablePurchases.sort((a, b) => b.totalPointsGained - a.totalPointsGained || b.score - a.score);
            const topBuy = affordablePurchases[0];
            return topBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: topBuy.card.id }
                : { type: 'BUY_CARD', tier: topBuy.tier, cardId: topBuy.card.id };
        }

        // TACTIC 7: BUY 0-POINT CARDS ONLY IF CHEAP (<= 2 TOKENS) AND STRICTLY EARLY IN GAME (< 4 TIER 1 CARDS)
        if (affordablePurchases.length > 0 && totalTier1Cards < 4 && aiPlayer.prestige < 3) {
            const cheapEngineBuys = affordablePurchases.filter(p => p.netTokenCost <= 2);
            if (cheapEngineBuys.length > 0) {
                cheapEngineBuys.sort((a, b) => b.score - a.score);
                const topBuy = cheapEngineBuys[0];
                return topBuy.isReserved
                    ? { type: 'BUY_RESERVED', cardId: topBuy.card.id }
                    : { type: 'BUY_CARD', tier: topBuy.tier, cardId: topBuy.card.id };
            }
        }

        // ==============================================================
        // 6. TARGET CARDS & FASTEST PATH TO 15 POINTS (BANK & GOLD AWARE)
        // ==============================================================
        const bank = game.bank.tokens;
        const totalGoldAvailable = (aiPlayer.tokens[RESOURCES.GOLD] || 0) + (canReserve && bankHasGold ? (3 - (aiPlayer.reservedCards || []).length) : 0);

        const futureCandidates = allVisibleAndReserved.map(item => {
            const evalData = evaluateCardForPurchase(item);

            let missingTokens = 0;
            let unavailableInBank = 0;
            const deficits = {};
            for (const [res, amt] of Object.entries(item.card.cost || {})) {
                const haveBonus = aiPlayer.bonuses[res] || 0;
                const haveTokens = aiPlayer.tokens[res] || 0;
                const needed = Math.max(0, amt - haveBonus);
                if (haveTokens < needed) {
                    const diff = needed - haveTokens;
                    missingTokens += diff;
                    deficits[res] = diff;
                    const inBank = bank[res] || 0;
                    if (inBank < diff) {
                        unavailableInBank += (diff - inBank);
                    }
                }
            }
            const gold = aiPlayer.tokens[RESOURCES.GOLD] || 0;
            missingTokens = Math.max(0, missingTokens - gold);
            // Gold wildcards can cover unavailable bank tokens
            unavailableInBank = Math.max(0, unavailableInBank - totalGoldAvailable);

            const turnsNeeded = Math.ceil(missingTokens / 2.5) + (unavailableInBank * 1.5);
            // Hyper-rush point density formula: (Points^1.8 * 80) / (Turns + 1)
            const pointPower = Math.pow(Math.max(0.1, evalData.totalPointsGained), 1.8) * 120.0;
            const speedScore = (pointPower + evalData.score) / (turnsNeeded + 1.0);

            return {
                ...item,
                ...evalData,
                missingTokens,
                unavailableInBank,
                turnsNeeded,
                deficits,
                speedScore
            };
        }).sort((a, b) => b.speedScore - a.speedScore);

        let primaryTarget = futureCandidates[0];
        // If we have reserved point cards, prioritize funding and completing them first!
        const myReservedPointCards = futureCandidates.filter(c => c.isReserved && c.totalPointsGained > 0);
        if (myReservedPointCards.length > 0) {
            myReservedPointCards.sort((a, b) => a.turnsNeeded - b.turnsNeeded || b.totalPointsGained - a.totalPointsGained);
            primaryTarget = myReservedPointCards[0];
        }

        // ==============================================================
        // 7. STRATEGIC RESERVATION (LOCK HIGH-POINT TARGETS EARLY & GAIN GOLD)
        // ==============================================================
        if (canReserve && bankHasGold) {
            // Find best visible 3, 4, or 5 point card to reserve
            const visiblePointCards = futureCandidates.filter(c => !c.isReserved && c.card.points >= 2);
            if (visiblePointCards.length > 0) {
                visiblePointCards.sort((a, b) => b.card.points - a.card.points || b.speedScore - a.speedScore);
                const bestToReserve = visiblePointCards[0];
                if (bestToReserve.card.points >= 3 || aiPlayer.purchasedCards.length >= 2 || (criticalDenialCard && criticalDenialCard.card.id === bestToReserve.card.id)) {
                    return {
                        type: 'RESERVE_CARD',
                        tier: bestToReserve.tier,
                        cardId: bestToReserve.card.id
                    };
                }
            }
        }

        // ==============================================================
        // 8. OPTIMAL TOKEN COMBINATORICS (ALWAYS TAKE TOKENS TO BUILD RESERVES)
        // ==============================================================
        const availableColors = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        const fourPlusColors = availableColors.filter(res => (bank[res] || 0) >= 4);
        for (const res of fourPlusColors) {
            if (primaryTarget && primaryTarget.deficits[res] >= 2 && aiPlayer.getTotalTokenCount() <= 8) {
                return { type: 'TAKE_TWO', resource: res };
            }
        }

        const combinedNeeds = {};
        if (primaryTarget) {
            for (const [res, count] of Object.entries(primaryTarget.deficits || {})) {
                combinedNeeds[res] = (combinedNeeds[res] || 0) + (count * 100.0);
            }
        }
        for (const [res, weight] of Object.entries(patronDesirability)) {
            combinedNeeds[res] = (combinedNeeds[res] || 0) + (weight * 10.0);
        }
        for (const [res, count] of Object.entries(marketBonusDemand)) {
            combinedNeeds[res] = (combinedNeeds[res] || 0) + count;
        }

        const rankedColors = availableColors.sort((a, b) => {
            const needA = combinedNeeds[a] || 0;
            const needB = combinedNeeds[b] || 0;
            return needB - needA;
        });

        const currentCount = aiPlayer.getTotalTokenCount();
        if (availableColors.length > 0 && currentCount < RULES.MAX_PLAYER_TOKENS) {
            const space = RULES.MAX_PLAYER_TOKENS - currentCount;
            const takeCount = Math.min(3, Math.min(space, availableColors.length));

            if (takeCount > 0) {
                const chosen = rankedColors.slice(0, takeCount);
                return { type: 'TAKE_DIFFERENT', tokens: chosen };
            }
        }

        // TACTIC: If unable to take tokens and bank has gold, reserve a Tier 3 card!
        if (canReserve && bankHasGold) {
            const visibleTier3 = (game.visibleMarket[3] || []);
            if (visibleTier3.length > 0) {
                return { type: 'RESERVE_CARD', tier: 3, cardId: visibleTier3[0].id };
            }
            const visibleTier2 = (game.visibleMarket[2] || []);
            if (visibleTier2.length > 0) {
                return { type: 'RESERVE_CARD', tier: 2, cardId: visibleTier2[0].id };
            }
        }

        if (affordablePurchases.length > 0) {
            const fallback = affordablePurchases[0];
            return fallback.isReserved
                ? { type: 'BUY_RESERVED', cardId: fallback.card.id }
                : { type: 'BUY_CARD', tier: fallback.tier, cardId: fallback.card.id };
        }

        return { type: 'PASS' };
    }
}
