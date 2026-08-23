import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class GrandmasterAI {
    /**
     * Compute the highest-tier master-level strategic action for the AI bot
     * Focuses on: Lowest token cost per card, rapid discount snowballing, and round tempo dominance.
     * @param {GameState} game 
     * @param {Player} aiPlayer 
     * @returns {Object} Action descriptor
     */
    static computeBestAction(game, aiPlayer) {
        if (!game || !aiPlayer || game.isGameOver) return { type: 'PASS' };

        const patrons = game.availablePatrons || [];
        const opponents = game.players.filter(p => p !== aiPlayer);
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        const bankHasGold = (game.bank.tokens[RESOURCES.GOLD] || 0) > 0;
        const totalDiscounts = Object.values(aiPlayer.bonuses || {}).reduce((a, b) => a + b, 0);

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
                            criticalDenialCard = { card, tier, priority: 50 };
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
                    patronDesirability[res] = (patronDesirability[res] || 0) + (patron.points / (diff + 1)) * 6.0;
                }
            }
        });

        // Measure how much each bonus color is demanded by high-tier cards (Tier 2 & 3)
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
            
            // Calculate NET tokens that must actually be spent from hand (after discounts)
            let netTokenCost = 0;
            for (const [res, amt] of Object.entries(card.cost || {})) {
                const discount = aiPlayer.bonuses[res] || 0;
                netTokenCost += Math.max(0, amt - discount);
            }

            // Check patron trigger
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

            // Direct Points Score
            score += totalPointsGained * 25.0;

            // Free card bonus: Buying for 0 net tokens is an immediate free round!
            if (netTokenCost === 0) {
                score += 50.0;
            } else if (netTokenCost === 1) {
                score += 30.0;
            } else if (netTokenCost === 2) {
                score += 18.0;
            } else if (netTokenCost === 3) {
                score += 8.0;
            }

            // High Tier points
            if (card.points >= 4) score += 35.0;
            else if (card.points >= 3) score += 20.0;
            else if (card.points >= 2) score += 10.0;

            // Permanent Discount Acceleration (Market Demand + Patron Alignment)
            score += (marketBonusDemand[card.bonus] || 0) * 2.0;
            score += (patronDesirability[card.bonus] || 0) * 3.5;

            // Efficiency ratio: Value divided by net tokens spent
            const efficiency = (score + 10.0) / (netTokenCost + 1);

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
        // 5. EVALUATE AFFORDABLE PURCHASES (CHECK FREE & FAST BUYS)
        // ==============================================================
        const affordablePurchases = [];
        for (const item of allVisibleAndReserved) {
            try {
                RuleEngine.calculateActualCost(aiPlayer, item.card.cost);
                const evalData = evaluateCardForPurchase(item);
                affordablePurchases.push({
                    ...item,
                    ...evalData
                });
            } catch (e) {
                // Not affordable
            }
        }

        // TACTIC 1: IMMEDIATE WINNING PURCHASE
        const winningBuy = affordablePurchases.find(p => p.winsGame);
        if (winningBuy) {
            return winningBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: winningBuy.card.id }
                : { type: 'BUY_CARD', tier: winningBuy.tier, cardId: winningBuy.card.id };
        }

        // TACTIC 2: ZERO-COST "FREE" PURCHASES (100% DISCOUNT)
        // If any card costs 0 net tokens, ALWAYS buy it! It builds permanent discounts without spending a single token!
        const freePurchases = affordablePurchases.filter(p => p.netTokenCost === 0);
        if (freePurchases.length > 0) {
            freePurchases.sort((a, b) => b.efficiency - a.efficiency);
            const bestFree = freePurchases[0];
            return bestFree.isReserved
                ? { type: 'BUY_RESERVED', cardId: bestFree.card.id }
                : { type: 'BUY_CARD', tier: bestFree.tier, cardId: bestFree.card.id };
        }

        // TACTIC 3: HIGH-TEMPO AFFORDABLE CARD (LOW TOKENS SPENT OR HIGH POINTS)
        if (affordablePurchases.length > 0) {
            affordablePurchases.sort((a, b) => b.efficiency - a.efficiency);
            const topBuy = affordablePurchases[0];

            // In early game, buy if net token cost is low (<= 3 tokens) to build discounts rapidly.
            // In late game (or when card gives points), buy if it gives points!
            if (topBuy.netTokenCost <= 3 || topBuy.totalPointsGained > 0 || aiPlayer.prestige >= 8) {
                return topBuy.isReserved
                    ? { type: 'BUY_RESERVED', cardId: topBuy.card.id }
                    : { type: 'BUY_CARD', tier: topBuy.tier, cardId: topBuy.card.id };
            }
        }

        // ==============================================================
        // 6. TARGET CARDS & FASTEST PATH TO 15 POINTS
        // ==============================================================
        const futureCandidates = allVisibleAndReserved.map(item => {
            const evalData = evaluateCardForPurchase(item);

            let missingTokens = 0;
            const deficits = {};
            for (const [res, amt] of Object.entries(item.card.cost || {})) {
                const haveBonus = aiPlayer.bonuses[res] || 0;
                const haveTokens = aiPlayer.tokens[res] || 0;
                const needed = Math.max(0, amt - haveBonus);
                if (haveTokens < needed) {
                    const diff = needed - haveTokens;
                    missingTokens += diff;
                    deficits[res] = diff;
                }
            }
            const gold = aiPlayer.tokens[RESOURCES.GOLD] || 0;
            missingTokens = Math.max(0, missingTokens - gold);

            const turnsNeeded = Math.ceil(missingTokens / 2.5);
            const overallSpeedScore = evalData.efficiency / (turnsNeeded + 1);

            return {
                ...item,
                ...evalData,
                missingTokens,
                turnsNeeded,
                deficits,
                overallSpeedScore
            };
        }).sort((a, b) => b.overallSpeedScore - a.overallSpeedScore);

        const primaryTarget = futureCandidates[0];

        // ==============================================================
        // 7. STRATEGIC RESERVATION (LOCK HIGH-TIER COMBO + GOLD)
        // ==============================================================
        if (canReserve && bankHasGold && primaryTarget && !primaryTarget.isReserved) {
            // Reserve high-value Tier 3 (3-5 pts) cards or critical combo pieces
            if (primaryTarget.card.points >= 3 || (criticalDenialCard && criticalDenialCard.card.id === primaryTarget.card.id)) {
                return {
                    type: 'RESERVE_CARD',
                    tier: primaryTarget.tier,
                    cardId: primaryTarget.card.id
                };
            }
        }

        // ==============================================================
        // 8. OPTIMAL TOKEN COMBINATORICS (TARGET SPECIFIC DEFICITS)
        // ==============================================================
        const bank = game.bank.tokens;
        const availableColors = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        // Option A: Take 2 tokens of same color if 4+ in bank and needed for primary target
        const fourPlusColors = availableColors.filter(res => (bank[res] || 0) >= 4);
        for (const res of fourPlusColors) {
            if (primaryTarget && primaryTarget.deficits[res] >= 2) {
                return { type: 'TAKE_TWO', resource: res };
            }
        }

        // Option B: Take 3 distinct needed tokens prioritizing the fastest-to-build discount cards
        const combinedNeeds = {};
        futureCandidates.slice(0, 4).forEach((target, rank) => {
            const weight = (4 - rank);
            for (const [res, count] of Object.entries(target.deficits)) {
                combinedNeeds[res] = (combinedNeeds[res] || 0) + (count * weight * 2.0);
            }
        });

        // Add patron and market discount weights
        for (const [res, weight] of Object.entries(patronDesirability)) {
            combinedNeeds[res] = (combinedNeeds[res] || 0) + weight;
        }
        for (const [res, count] of Object.entries(marketBonusDemand)) {
            combinedNeeds[res] = (combinedNeeds[res] || 0) + (count * 1.5);
        }

        const rankedColors = availableColors.sort((a, b) => {
            const needA = combinedNeeds[a] || 0;
            const needB = combinedNeeds[b] || 0;
            return needB - needA;
        });

        if (rankedColors.length > 0) {
            const currentCount = aiPlayer.getTotalTokenCount();
            let takeCount = Math.min(3, rankedColors.length);

            // Avoid overflowing 10 tokens unless immediately useful
            if (currentCount + takeCount > RULES.MAX_PLAYER_TOKENS) {
                const space = RULES.MAX_PLAYER_TOKENS - currentCount;
                if (space > 0) {
                    takeCount = Math.min(takeCount, space);
                }
            }

            const chosen = rankedColors.slice(0, Math.max(1, takeCount));
            return { type: 'TAKE_DIFFERENT', tokens: chosen };
        }

        // Fallback: Purchase any affordable card or pass
        if (affordablePurchases.length > 0) {
            const fallback = affordablePurchases[0];
            return fallback.isReserved
                ? { type: 'BUY_RESERVED', cardId: fallback.card.id }
                : { type: 'BUY_CARD', tier: fallback.tier, cardId: fallback.card.id };
        }

        return { type: 'PASS' };
    }
}
