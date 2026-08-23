import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class GrandmasterAI {
    /**
     * Compute the highest-tier strategic action for the AI bot
     * @param {GameState} game 
     * @param {Player} aiPlayer 
     * @returns {Object} Action descriptor
     */
    static computeBestAction(game, aiPlayer) {
        if (!game || !aiPlayer || game.isGameOver) return { type: 'PASS' };

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
                    patronNeeds[res] = (patronNeeds[res] || 0) + (patron.points / (diff + 1)) * 4.0;
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

            // Check if opponent can afford any visible game-ending cards
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

            // Prestige points value (exponential scaling in late game)
            if (aiPlayer.prestige >= 10 || game.isFinalRound) {
                score += card.points * 30.0;
            } else {
                score += card.points * 14.0;
            }

            // High Tier 3 milestone bonus
            if (card.points >= 4) score += 20.0;
            else if (card.points >= 3) score += 12.0;

            // Patron synergy
            if (patronNeeds[card.bonus]) {
                score += patronNeeds[card.bonus] * 3.0;
            }

            // Engine building bonus: how much this bonus helps buy other visible cards in market
            let bonusMarketUtility = 0;
            for (let t = 2; t <= 3; t++) {
                (game.visibleMarket[t] || []).forEach(otherCard => {
                    if (otherCard.cost && otherCard.cost[card.bonus]) {
                        bonusMarketUtility += (otherCard.cost[card.bonus] * 1.5);
                    }
                });
            }
            score += Math.min(bonusMarketUtility, 10.0);

            // Early game Tier 1 efficiency (cheap bonuses build the engine)
            if (tier === 1 && aiPlayer.prestige < 8) {
                const totalCost = Object.values(card.cost || {}).reduce((a, b) => a + b, 0);
                if (totalCost <= 4) score += 8.0;
            }

            return score;
        };

        // Gather all cards (market + reserved)
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

                // Check if buying this claims a patron
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
                    score: baseScore + (patronReward * 20.0) + (winsGame ? 500.0 : 0),
                    totalPointsGained,
                    winsGame
                });
            } catch (e) {
                // Not affordable
            }
        }

        // TACTIC 1: If AI can win the game THIS TURN, execute immediately!
        const winningAction = affordableCards.find(c => c.winsGame);
        if (winningAction) {
            return winningAction.isReserved
                ? { type: 'BUY_RESERVED', cardId: winningAction.card.id }
                : { type: 'BUY_CARD', tier: winningAction.tier, cardId: winningAction.card.id };
        }

        // TACTIC 2: Opponent Denial Reservation (Block human opponent's immediate winning card)
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        if (opponentWinThreat && canReserve) {
            return {
                type: 'RESERVE_CARD',
                tier: opponentWinThreat.tier,
                cardId: opponentWinThreat.card.id
            };
        }

        // TACTIC 3: High-Value Affordable Purchase
        if (affordableCards.length > 0) {
            affordableCards.sort((a, b) => b.score - a.score);
            const topBuy = affordableCards[0];
            // Buy if it's a solid card or if we have high prestige
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
            
            // Calculate deficit
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

            // Efficiency: score divided by turns to acquire
            const turnsNeeded = Math.ceil(missingTokens / 2.5);
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

        // TACTIC 4: Strategic Snatch / Hold (Reserve high-impact 3+ point card if affordable soon)
        const bankHasGold = (game.bank.tokens[RESOURCES.GOLD] || 0) > 0;
        if (canReserve && bankHasGold && primaryTarget && !primaryTarget.isReserved) {
            // If primary target is a 3-5 point card, or if an opponent is threatening high points
            if (primaryTarget.card.points >= 3 || (opponentHighThreat && opponentHighThreat.card.id === primaryTarget.card.id)) {
                return {
                    type: 'RESERVE_CARD',
                    tier: primaryTarget.tier,
                    cardId: primaryTarget.card.id
                };
            }
        }

        // ==============================================================
        // 6. OPTIMAL TOKEN COMBINATORICS (No Wasted Actions)
        // ==============================================================
        const bank = game.bank.tokens;
        const availableGems = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        // Candidate 1: Take 2 of the same token (if 4+ in bank and needed for top targets)
        const takeTwoOptions = availableGems.filter(res => (bank[res] || 0) >= 4);
        for (const res of takeTwoOptions) {
            if (primaryTarget && primaryTarget.deficits[res] >= 2) {
                return { type: 'TAKE_TWO', resource: res };
            }
        }

        // Candidate 2: Take 3 distinct gems matching deficits across top 3 target cards
        const combinedDeficits = {};
        futureTargetCandidates.slice(0, 3).forEach((target, weightIdx) => {
            const multiplier = (3 - weightIdx);
            for (const [res, count] of Object.entries(target.deficits)) {
                combinedDeficits[res] = (combinedDeficits[res] || 0) + (count * multiplier) + (patronNeeds[res] || 0);
            }
        });

        // Rank available gems by weighted deficit need
        const rankedGems = availableGems.sort((a, b) => {
            const needA = combinedDeficits[a] || 0;
            const needB = combinedDeficits[b] || 0;
            return needB - needA;
        });

        if (rankedGems.length > 0) {
            const currentTotal = aiPlayer.getTotalTokenCount();
            let takeAmount = Math.min(3, rankedGems.length);

            // Avoid taking tokens that force an unnecessary discard
            if (currentTotal + takeAmount > RULES.MAX_PLAYER_TOKENS) {
                const safeSpace = RULES.MAX_PLAYER_TOKENS - currentTotal;
                if (safeSpace > 0) {
                    takeAmount = Math.min(takeAmount, safeSpace);
                }
            }

            const chosenTokens = rankedGems.slice(0, Math.max(1, takeAmount));
            return { type: 'TAKE_DIFFERENT', tokens: chosenTokens };
        }

        // TACTIC 5: If nothing else, buy any affordable card or pass
        if (affordableCards.length > 0) {
            const fallbackBuy = affordableCards[0];
            return fallbackBuy.isReserved
                ? { type: 'BUY_RESERVED', cardId: fallbackBuy.card.id }
                : { type: 'BUY_CARD', tier: fallbackBuy.tier, cardId: fallbackBuy.card.id };
        }

        return { type: 'PASS' };
    }
}
