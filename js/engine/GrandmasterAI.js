import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class GrandmasterAI {
    // Evolutionary trained weights from 2,000+ self-play tournament matches
    static DEFAULT_WEIGHTS = {
        prestigeWeight: 14.52,
        endgameSprintMultiplier: 22.06,
        patronSynergyWeight: 3.05,
        tier1EfficiencyWeight: 8.75,
        engineDemandMultiplier: 1.54,
        tier3MilestoneBonus: 13.12,
        tier3HighPointBonus: 16.36,
        denialUrgency: 40.38,
        turnsLookaheadDiscount: 2.84,
        patronCompletionReward: 20.12
    };

    /**
     * Compute best strategic action using default evolved weights
     */
    static computeBestAction(game, aiPlayer) {
        return this.computeBestActionWithWeights(game, aiPlayer, this.DEFAULT_WEIGHTS);
    }

    /**
     * Compute the highest-tier strategic action using customizable/trained weight genome
     * @param {GameState} game 
     * @param {Player} aiPlayer 
     * @param {Object} w Weight genome
     * @returns {Object} Action descriptor
     */
    static computeBestActionWithWeights(game, aiPlayer, w = this.DEFAULT_WEIGHTS) {
        if (!game || !aiPlayer || game.isGameOver) return { type: 'PASS' };

        const weights = { ...this.DEFAULT_WEIGHTS, ...w };

        // ==============================================================
        // 1. ANALYZE PATRON TARGETS & GEM SYNERGIES
        // ==============================================================
        const patronNeeds = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        const patrons = game.availablePatrons || [];
        
        patrons.forEach(patron => {
            let totalMissingForPatron = 0;
            for (const [res, req] of Object.entries(patron.requirements)) {
                const have = aiPlayer.bonuses[res] || 0;
                if (have < req) {
                    const diff = req - have;
                    totalMissingForPatron += diff;
                    patronNeeds[res] = (patronNeeds[res] || 0) + (patron.points / (diff + 1)) * (weights.patronSynergyWeight * 1.3);
                }
            }
        });

        // ==============================================================
        // 2. ANALYZE OPPONENT THREATS & DENIAL TARGETS (Hate-Drafting)
        // ==============================================================
        let opponentWinThreat = null;
        let opponentHighThreat = null;

        const opponents = game.players.filter(p => p !== aiPlayer);
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
                            opponentWinThreat = { card, tier, opponent: opp };
                            break;
                        } else if (card.points >= 3 && oppPrestige >= 9) {
                            opponentHighThreat = { card, tier, opponent: opp };
                        }
                    } catch (e) {
                        // Opponent cannot afford
                    }
                }
                if (opponentWinThreat) break;
            }
            if (opponentWinThreat) break;
        }

        // ==============================================================
        // 3. CARD SCORING HEURISTIC FUNCTION
        // ==============================================================
        const scoreCard = (card, tier) => {
            let score = 0;

            if (aiPlayer.prestige >= 10 || game.isFinalRound) {
                score += card.points * weights.endgameSprintMultiplier;
            } else {
                score += card.points * weights.prestigeWeight;
            }

            if (card.points >= 4) score += weights.tier3HighPointBonus;
            else if (card.points >= 3) score += weights.tier3MilestoneBonus;

            if (patronNeeds[card.bonus]) {
                score += patronNeeds[card.bonus] * weights.patronSynergyWeight;
            }

            let bonusMarketUtility = 0;
            for (let t = 2; t <= 3; t++) {
                (game.visibleMarket[t] || []).forEach(otherCard => {
                    if (otherCard.cost && otherCard.cost[card.bonus]) {
                        bonusMarketUtility += (otherCard.cost[card.bonus] * weights.engineDemandMultiplier);
                    }
                });
            }
            score += Math.min(bonusMarketUtility, 10.0);

            if (tier === 1 && aiPlayer.prestige < 8) {
                const totalCost = Object.values(card.cost || {}).reduce((a, b) => a + b, 0);
                if (totalCost <= 4) score += weights.tier1EfficiencyWeight;
            }

            return score;
        };

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
        // 4. FIND AFFORDABLE CARDS & CHECK IMMEDIATE VICTORY
        // ==============================================================
        const affordableCards = [];
        for (const item of allVisibleAndReserved) {
            try {
                RuleEngine.calculateActualCost(aiPlayer, item.card.cost);
                const baseScore = scoreCard(item.card, item.tier);

                const simBonuses = { ...aiPlayer.bonuses, [item.card.bonus]: (aiPlayer.bonuses[item.card.bonus] || 0) + 1 };
                let patronReward = 0;
                patrons.forEach(p => {
                    if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                        patronReward += p.points;
                    }
                });

                const totalPointsGained = item.card.points + patronReward;
                const winsGame = (aiPlayer.prestige + totalPointsGained) >= RULES.VICTORY_THRESHOLD;

                affordableCards.push({
                    ...item,
                    score: baseScore + (patronReward * weights.patronCompletionReward) + (winsGame ? 500.0 : 0),
                    totalPointsGained,
                    winsGame
                });
            } catch (e) {
                // Not affordable
            }
        }

        // Immediate victory
        const winningAction = affordableCards.find(c => c.winsGame);
        if (winningAction) {
            return winningAction.isReserved
                ? { type: 'BUY_RESERVED', cardId: winningAction.card.id }
                : { type: 'BUY_CARD', tier: winningAction.tier, cardId: winningAction.card.id };
        }

        // Opponent denial
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        if (opponentWinThreat && canReserve) {
            return {
                type: 'RESERVE_CARD',
                tier: opponentWinThreat.tier,
                cardId: opponentWinThreat.card.id
            };
        }

        // High-value purchase
        if (affordableCards.length > 0) {
            affordableCards.sort((a, b) => b.score - a.score);
            const topBuy = affordableCards[0];
            if (topBuy.score >= 12.0 || aiPlayer.prestige >= 8 || topBuy.totalPointsGained > 0) {
                return topBuy.isReserved
                    ? { type: 'BUY_RESERVED', cardId: topBuy.card.id }
                    : { type: 'BUY_CARD', tier: topBuy.tier, cardId: topBuy.card.id };
            }
        }

        // ==============================================================
        // 5. EVALUATE FUTURE TARGET CARDS (Lookahead Planning)
        // ==============================================================
        const futureTargetCandidates = allVisibleAndReserved.map(item => {
            const baseScore = scoreCard(item.card, item.tier);
            
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

            const turnsNeeded = Math.ceil(missingTokens / weights.turnsLookaheadDiscount);
            const efficiency = baseScore / (turnsNeeded + 1);

            return {
                ...item,
                efficiency,
                baseScore,
                missingTokens,
                deficits
            };
        }).sort((a, b) => b.efficiency - a.efficiency);

        const primaryTarget = futureTargetCandidates[0];

        // Strategic Snatch & Gold Reserve
        const bankHasGold = (game.bank.tokens[RESOURCES.GOLD] || 0) > 0;
        if (canReserve && bankHasGold && primaryTarget && !primaryTarget.isReserved) {
            if (primaryTarget.card.points >= 3 || (opponentHighThreat && opponentHighThreat.card.id === primaryTarget.card.id)) {
                return {
                    type: 'RESERVE_CARD',
                    tier: primaryTarget.tier,
                    cardId: primaryTarget.card.id
                };
            }
        }

        // ==============================================================
        // 6. OPTIMAL TOKEN COMBINATORICS
        // ==============================================================
        const bank = game.bank.tokens;
        const availableGems = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        const takeTwoOptions = availableGems.filter(res => (bank[res] || 0) >= 4);
        for (const res of takeTwoOptions) {
            if (primaryTarget && primaryTarget.deficits[res] >= 2) {
                return { type: 'TAKE_TWO', resource: res };
            }
        }

        const combinedDeficits = {};
        futureTargetCandidates.slice(0, 3).forEach((target, weightIdx) => {
            const multiplier = (3 - weightIdx);
            for (const [res, count] of Object.entries(target.deficits)) {
                combinedDeficits[res] = (combinedDeficits[res] || 0) + (count * multiplier) + (patronNeeds[res] || 0);
            }
        });

        const rankedGems = availableGems.sort((a, b) => {
            const needA = combinedDeficits[a] || 0;
            const needB = combinedDeficits[b] || 0;
            return needB - needA;
        });

        if (rankedGems.length > 0) {
            const currentTotal = aiPlayer.getTotalTokenCount();
            let takeAmount = Math.min(3, rankedGems.length);

            if (currentTotal + takeAmount > RULES.MAX_PLAYER_TOKENS) {
                const safeSpace = RULES.MAX_PLAYER_TOKENS - currentTotal;
                if (safeSpace > 0) {
                    takeAmount = Math.min(takeAmount, safeSpace);
                }
            }

            const chosenTokens = rankedGems.slice(0, Math.max(1, takeAmount));
            return { type: 'TAKE_DIFFERENT', tokens: chosenTokens };
        }

        if (affordableCards.length > 0) {
            const fallbackBuy = affordableCards[0];
            return fallbackBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: fallbackBuy.card.id }
                : { type: 'BUY_CARD', tier: fallbackBuy.tier, cardId: fallbackBuy.card.id };
        }

        return { type: 'PASS' };
    }
}
