import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class GrandmasterAI {
    /**
     * Compute the highest-tier master-level strategic action for the AI bot
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
                        
                        // Check if this card gives opponent victory or patron
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
                        } else if (card.points >= 3 && oppPrestige >= 9) {
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
        // 2. CHECK ALL CURRENTLY AFFORDABLE PURCHASES
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

        const affordablePurchases = [];
        for (const item of allVisibleAndReserved) {
            try {
                RuleEngine.calculateActualCost(aiPlayer, item.card.cost);
                
                // Calculate patron trigger
                const simBonuses = { ...aiPlayer.bonuses, [item.card.bonus]: (aiPlayer.bonuses[item.card.bonus] || 0) + 1 };
                let patronReward = 0;
                patrons.forEach(p => {
                    if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                        patronReward += p.points;
                    }
                });

                const totalPoints = item.card.points + patronReward;
                const winsGame = (aiPlayer.prestige + totalPoints) >= RULES.VICTORY_THRESHOLD;

                affordablePurchases.push({
                    ...item,
                    totalPoints,
                    patronReward,
                    winsGame,
                    efficiency: (totalPoints * 10) + (item.card.tier === 1 ? 1 : (item.card.tier * 3))
                });
            } catch (e) {
                // Cannot afford
            }
        }

        // RULE: If we can WIN THE GAME RIGHT NOW, BUY IT!
        const winningBuy = affordablePurchases.find(p => p.winsGame);
        if (winningBuy) {
            return winningBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: winningBuy.card.id }
                : { type: 'BUY_CARD', tier: winningBuy.tier, cardId: winningBuy.card.id };
        }

        // ==============================================================
        // 3. NOBLE PATRON PATHFINDING & COMBINATORIAL VALUATION
        // ==============================================================
        const patronDesirability = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        patrons.forEach(patron => {
            let missingForPatron = 0;
            for (const [res, req] of Object.entries(patron.requirements)) {
                const have = aiPlayer.bonuses[res] || 0;
                if (have < req) {
                    const diff = req - have;
                    missingForPatron += diff;
                    patronDesirability[res] = (patronDesirability[res] || 0) + (patron.points / (diff + 1)) * 5.0;
                }
            }
        });

        // Evaluate all cards in the market with Master heuristic
        const evaluateCard = (card, tier) => {
            let score = 0;

            // Direct Prestige Points
            score += card.points * 16.0;

            // High Tier 3 points
            if (card.points >= 4) score += 24.0;
            else if (card.points >= 3) score += 15.0;
            else if (card.points >= 2) score += 8.0;

            // Patron Synergy
            if (patronDesirability[card.bonus]) {
                score += patronDesirability[card.bonus] * 3.5;
            }

            // Market Demand / Future discount utility
            let futureUtility = 0;
            for (let t = 2; t <= 3; t++) {
                (game.visibleMarket[t] || []).forEach(other => {
                    if (other.cost && other.cost[card.bonus]) {
                        futureUtility += other.cost[card.bonus] * 1.8;
                    }
                });
            }
            score += Math.min(futureUtility, 12.0);

            // Tier 1 card filter: ONLY reward Tier 1 cards that are ultra-cheap (cost <= 4) or match patron
            if (tier === 1) {
                const totalCost = Object.values(card.cost || {}).reduce((a, b) => a + b, 0);
                if (card.points === 0) {
                    if (totalCost > 4 && !patronDesirability[card.bonus]) {
                        score -= 10.0; // Penalize expensive 0-point trap cards!
                    } else if (totalCost <= 4) {
                        score += 6.0;
                    }
                }
            }

            // Late game urgency
            if (aiPlayer.prestige >= 9 || game.isFinalRound) {
                score += card.points * 28.0;
            }

            return score;
        };

        // ==============================================================
        // 4. BUY HIGH-SCORING AFFORDABLE CARD (IF HIGH UTILITY)
        // ==============================================================
        if (affordablePurchases.length > 0) {
            affordablePurchases.forEach(item => {
                item.score = evaluateCard(item.card, item.tier) + (item.patronReward * 35.0);
            });
            affordablePurchases.sort((a, b) => b.score - a.score);

            const topAffordable = affordablePurchases[0];
            // Buy if it gives points, claims a patron, or has high strategic score
            if (topAffordable.totalPoints > 0 || topAffordable.score >= 12.0 || aiPlayer.prestige >= 8) {
                return topAffordable.isReserved
                    ? { type: 'BUY_RESERVED', cardId: topAffordable.card.id }
                    : { type: 'BUY_CARD', tier: topAffordable.tier, cardId: topAffordable.card.id };
            }
        }

        // ==============================================================
        // 5. SELECT TOP GOAL CARDS & CALCULATE EXACT TOKEN DEFICIT
        // ==============================================================
        const futureCandidates = allVisibleAndReserved.map(item => {
            const score = evaluateCard(item.card, item.tier);
            
            // Calculate missing tokens
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
            const efficiency = score / (turnsNeeded + 1);

            return {
                ...item,
                score,
                efficiency,
                missingTokens,
                deficits
            };
        }).sort((a, b) => b.efficiency - a.efficiency);

        const primaryTarget = futureCandidates[0];

        // ==============================================================
        // 6. PROACTIVE STRATEGIC RESERVATION (Accelerate with Gold!)
        // ==============================================================
        if (canReserve && bankHasGold && primaryTarget && !primaryTarget.isReserved) {
            // If primary target is a massive 3-5 point card, reserve it to lock it in and get Gold!
            if (primaryTarget.card.points >= 3 || (criticalDenialCard && criticalDenialCard.card.id === primaryTarget.card.id)) {
                return {
                    type: 'RESERVE_CARD',
                    tier: primaryTarget.tier,
                    cardId: primaryTarget.card.id
                };
            }
            // In early/mid game, if AI has < 2 reserved cards and finds a Tier 2 (2+ pts) card
            if (primaryTarget.card.points >= 2 && (aiPlayer.reservedCards || []).length < 2 && aiPlayer.getTotalTokenCount() <= 6) {
                return {
                    type: 'RESERVE_CARD',
                    tier: primaryTarget.tier,
                    cardId: primaryTarget.card.id
                };
            }
        }

        // ==============================================================
        // 7. OPTIMAL TOKEN MATH (No Wasted Capacity)
        // ==============================================================
        const bank = game.bank.tokens;
        const availableColors = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        // Candidate A: Take 2 of the same token (if 4+ in bank and needed for top targets)
        const fourPlusColors = availableColors.filter(res => (bank[res] || 0) >= 4);
        for (const res of fourPlusColors) {
            if (primaryTarget && primaryTarget.deficits[res] >= 2) {
                return { type: 'TAKE_TWO', resource: res };
            }
        }

        // Candidate B: Take 3 different needed colors matching top target cards
        const combinedNeeds = {};
        futureCandidates.slice(0, 3).forEach((target, rank) => {
            const weight = (3 - rank);
            for (const [res, count] of Object.entries(target.deficits)) {
                combinedNeeds[res] = (combinedNeeds[res] || 0) + (count * weight * 2.0);
            }
        });

        // Add patron bonus weights
        for (const [res, weight] of Object.entries(patronDesirability)) {
            combinedNeeds[res] = (combinedNeeds[res] || 0) + weight;
        }

        // Rank available tokens by priority
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

        // Fallback: Purchase any affordable card
        if (affordablePurchases.length > 0) {
            const fallback = affordablePurchases[0];
            return fallback.isReserved
                ? { type: 'BUY_RESERVED', cardId: fallback.card.id }
                : { type: 'BUY_CARD', tier: fallback.tier, cardId: fallback.card.id };
        }

        return { type: 'PASS' };
    }
}
