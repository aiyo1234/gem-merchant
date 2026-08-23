import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class GrandmasterAI {
    /**
     * MASTERCLASS GRANDMASTER ENGINE (v10.0)
     * Executes the 3 Primary Winning Archetypes with Strict Turn Economy:
     * 1. Tier 3 "Rush" Strategy (~21-24 turns: 4-5 pt cards, Gold wildcards, 0-point bypass)
     * 2. Noble Hybrid Strategy (Targeted 8-10 card engine for 2+ Nobles + Tier 2 cards)
     * 3. Defensive Hate-Drafting & Stack-Dropping Token Denial
     */
    static computeBestAction(game, aiPlayer) {
        try {
            return this.computeMasterclassAction(game, aiPlayer);
        } catch (e) {
            return { type: 'PASS' };
        }
    }

    static computeBestActionWithWeights(game, aiPlayer, w) {
        return this.computeMasterclassAction(game, aiPlayer);
    }

    static computeMasterclassAction(game, aiPlayer) {
        if (!game || !aiPlayer || game.isGameOver) return { type: 'PASS' };

        const bank = game.bank.tokens;
        const patrons = game.availablePatrons || [];
        const opponents = game.players.filter(p => p !== aiPlayer);
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        const bankHasGold = (bank[RESOURCES.GOLD] || 0) > 0;

        // ==============================================================
        // 1. SETUP & BOARD EVALUATION (TURN 1 ASSESSMENT)
        // ==============================================================
        // A. Noble Synergies: Count overlapping color requirements across Nobles
        const nobleColorCounts = { ruby: 0, sapphire: 0, emerald: 0, onyx: 0, pearl: 0 };
        patrons.forEach(p => {
            Object.keys(p.requirements || {}).forEach(r => nobleColorCounts[r] = (nobleColorCounts[r] || 0) + 1);
        });
        const nobleRanked = Object.entries(nobleColorCounts).sort((a, b) => b[1] - a[1]);
        const hasNobleSynergy = (nobleRanked[0] && nobleRanked[0][1] >= 2 && nobleRanked[1] && nobleRanked[1][1] >= 2);
        const nobleFocus1 = nobleRanked[0] ? nobleRanked[0][0] : 'sapphire';
        const nobleFocus2 = nobleRanked[1] ? nobleRanked[1][0] : 'emerald';

        // B. Tier 3 Rush Assessment: Look for clean mono/dual-cost 4-5 pt cards (e.g. 7 White or 7 Red + 3 Green)
        const visibleT3 = game.visibleMarket[3] || [];
        const monoT3Cards = visibleT3.filter(c => {
            const costs = Object.values(c.cost || {});
            return costs.some(amt => amt >= 7) || (c.points >= 4 && costs.length <= 2);
        });

        // Archetype Decision: Tier 3 Rush vs Noble Hybrid
        const isTier3Rush = (monoT3Cards.length >= 1 || !hasNobleSynergy);

        // ==============================================================
        // 2. DEFENSIVE HATE-DRAFTING & OPPONENT STARVATION (CUTTHROAT 2P)
        // ==============================================================
        let urgentDenialCard = null;
        for (const opp of opponents) {
            const oppPrestige = opp.prestige || 0;
            for (let tier = 2; tier <= 3; tier++) {
                for (const card of (game.visibleMarket[tier] || [])) {
                    try {
                        RuleEngine.calculateActualCost(opp, card.cost);
                        const simBonuses = { ...opp.bonuses, [card.bonus]: (opp.bonuses[card.bonus] || 0) + 1 };
                        let extraPatronPts = 0;
                        patrons.forEach(p => {
                            if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                                extraPatronPts += p.points;
                            }
                        });

                        const projected = oppPrestige + card.points + extraPatronPts;
                        if (projected >= RULES.VICTORY_THRESHOLD) {
                            urgentDenialCard = { card, tier, priority: 100 };
                            break;
                        } else if (card.points >= 4 && oppPrestige >= 8) {
                            urgentDenialCard = { card, tier, priority: 60 };
                        }
                    } catch (e) {}
                }
                if (urgentDenialCard && urgentDenialCard.priority === 100) break;
            }
            if (urgentDenialCard && urgentDenialCard.priority === 100) break;
        }

        // Emergency Hate-Draft: Block opponent from winning next turn
        if (urgentDenialCard && urgentDenialCard.priority === 100 && canReserve) {
            return { type: 'RESERVE_CARD', tier: urgentDenialCard.tier, cardId: urgentDenialCard.card.id };
        }

        // ==============================================================
        // 3. GATHER & EVALUATE ALL PURCHASABLE CARDS (STRICT TURN ECONOMY)
        // ==============================================================
        const allCards = [];
        for (let t = 3; t >= 1; t--) {
            (game.visibleMarket[t] || []).forEach(card => allCards.push({ card, tier: t, isReserved: false }));
        }
        (aiPlayer.reservedCards || []).forEach(card => allCards.push({ card, tier: card.tier, isReserved: true }));

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
                const wins = (aiPlayer.prestige + totalPoints) >= RULES.VICTORY_THRESHOLD;

                let netTokens = 0;
                for (const [r, amt] of Object.entries(item.card.cost)) {
                    netTokens += Math.max(0, amt - (aiPlayer.bonuses[r] || 0));
                }

                // Spot Tier-1 Trap Cards: costs 4-5 gems for 0 points with 0 noble alignment
                const isNobleAligned = (item.card.bonus === nobleFocus1 || item.card.bonus === nobleFocus2);
                const isTrapCard = (item.tier === 1 && totalPoints === 0 && netTokens >= 4 && !isNobleAligned);
                if (isTrapCard) continue; // Purge trap cards

                // Turn Economy Scoring: High Points / Fewest Turns
                let score = (totalPoints * 600.0) + (item.card.points * 250.0) + (patronReward * 450.0) - (netTokens * 18.0) + (item.tier * 15.0);
                if (isNobleAligned) score += 90.0;
                if (netTokens === 0) score += 70.0;

                affordable.push({ ...item, totalPoints, patronReward, netTokens, wins, score });
            } catch (e) {}
        }

        // TACTIC 1: IMMEDIATE VICTORY PURCHASE (15+ Points)
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

        // TACTIC 3: BUY 1-POINT CARDS (PACE ADVANCEMENT)
        const oneBuys = affordable.filter(a => a.totalPoints >= 1);
        if (oneBuys.length > 0) {
            oneBuys.sort((a, b) => b.score - a.score);
            const top = oneBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 4: ZERO-COST FREE PURCHASES (IF SYNERGISTIC)
        const freeBuys = affordable.filter(a => a.netTokens === 0 && (a.totalPoints > 0 || a.card.bonus === nobleFocus1 || a.card.bonus === nobleFocus2));
        if (freeBuys.length > 0) {
            freeBuys.sort((a, b) => b.score - a.score);
            const top = freeBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 5: NOBLE HYBRID ENGINE BUILDING (ONLY IF NOBLE HYBRID AND < 4 TIER-1 DISCOUNTS)
        if (!isTier3Rush && aiPlayer.purchasedCards.length < 4 && aiPlayer.prestige < 3) {
            const cheapNobleCards = affordable.filter(a => a.tier === 1 && a.netTokens <= 2 && (a.card.bonus === nobleFocus1 || a.card.bonus === nobleFocus2));
            if (cheapNobleCards.length > 0) {
                cheapNobleCards.sort((a, b) => b.score - a.score);
                const top = cheapNobleCards[0];
                return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
            }
        }

        // TACTIC 6: ANTI-STALL TOKEN FLUSH (HOLDING 8+ TOKENS)
        if (affordable.length > 0 && aiPlayer.getTotalTokenCount() >= 8) {
            affordable.sort((a, b) => b.score - a.score);
            const top = affordable[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // ==============================================================
        // 4. STRATEGIC TARGET SELECTION & GOLD WILDCARD SPRINT
        // ==============================================================
        let target = null;
        if (aiPlayer.reservedCards && aiPlayer.reservedCards.length > 0) {
            const sortedRes = [...aiPlayer.reservedCards].sort((a, b) => b.points - a.points);
            target = { card: sortedRes[0], tier: sortedRes[0].tier, isReserved: true };
        }

        if (!target) {
            // If Tier 3 Rush: Target best mono/clean-cost 4-5 pt card
            if (isTier3Rush && monoT3Cards.length > 0) {
                monoT3Cards.sort((a, b) => b.points - a.points);
                target = { card: monoT3Cards[0], tier: 3, isReserved: false };
            } else {
                const visibleT3All = (game.visibleMarket[3] || []).filter(c => c.points >= 4);
                if (visibleT3All.length > 0) target = { card: visibleT3All[0], tier: 3, isReserved: false };
                else {
                    const visibleT2 = (game.visibleMarket[2] || []).filter(c => c.points >= 2);
                    if (visibleT2.length > 0) target = { card: visibleT2[0], tier: 2, isReserved: false };
                }
            }
        }

        // Strategic Gold Wildcard Reservation (Lock 4+ Point Card & Capture Gold)
        if (target && !target.isReserved && target.card.points >= 4 && canReserve && bankHasGold && (aiPlayer.reservedCards || []).length < 2) {
            return { type: 'RESERVE_CARD', tier: target.tier, cardId: target.card.id };
        }

        // Defensive Hate-Draft Reserving
        if (urgentDenialCard && urgentDenialCard.priority >= 60 && canReserve && bankHasGold && (aiPlayer.reservedCards || []).length < 2) {
            return { type: 'RESERVE_CARD', tier: urgentDenialCard.tier, cardId: urgentDenialCard.card.id };
        }

        // ==============================================================
        // 5. TOKEN DEFICIT OPTIMIZATION & STACK-DROPPING DENIAL
        // ==============================================================
        const deficits = {};
        if (target) {
            for (const [r, amt] of Object.entries(target.card.cost)) {
                const need = Math.max(0, amt - (aiPlayer.bonuses[r] || 0));
                const have = aiPlayer.tokens[r] || 0;
                if (have < need) deficits[r] = need - have;
            }

            // Take 2 of same color if deficit >= 2 and bank >= 4
            for (const [r, count] of Object.entries(deficits)) {
                if ((bank[r] || 0) >= 4 && count >= 2 && aiPlayer.getTotalTokenCount() <= 8) {
                    return { type: 'TAKE_TWO', resource: r };
                }
            }
        }

        if (!isTier3Rush) {
            if ((aiPlayer.bonuses[nobleFocus1] || 0) < 4) deficits[nobleFocus1] = (deficits[nobleFocus1] || 0) + 3;
            if ((aiPlayer.bonuses[nobleFocus2] || 0) < 4) deficits[nobleFocus2] = (deficits[nobleFocus2] || 0) + 2;
        }

        // STACK-DROPPING DENIAL: If opponent needs a color and bank has 4, taking it drops bank to 3!
        const oppNeeds = {};
        opponents.forEach(opp => {
            for (let t = 2; t <= 3; t++) {
                (game.visibleMarket[t] || []).forEach(c => {
                    if (c.points >= 2) {
                        for (const [r] of Object.entries(c.cost || {})) {
                            if ((bank[r] || 0) === 4) oppNeeds[r] = (oppNeeds[r] || 0) + 40;
                        }
                    }
                });
            }
        });

        const combinedNeeds = {};
        for (const [r, count] of Object.entries(deficits)) combinedNeeds[r] = (combinedNeeds[r] || 0) + (count * 100);
        for (const [r, count] of Object.entries(oppNeeds)) combinedNeeds[r] = (combinedNeeds[r] || 0) + count;

        const availableColors = Object.entries(bank)
            .filter(([res, count]) => res !== 'gold' && count > 0)
            .map(([res]) => res);

        const ranked = availableColors.sort((a, b) => (combinedNeeds[b] || 0) - (combinedNeeds[a] || 0));

        const curTokens = aiPlayer.getTotalTokenCount();
        if (ranked.length > 0 && curTokens < RULES.MAX_PLAYER_TOKENS) {
            const space = RULES.MAX_PLAYER_TOKENS - curTokens;
            const takeN = Math.min(3, Math.min(space, ranked.length));
            if (takeN > 0) return { type: 'TAKE_DIFFERENT', tokens: ranked.slice(0, takeN) };
        }

        if (canReserve && bankHasGold && (aiPlayer.reservedCards || []).length < 2) {
            const visibleT3All = game.visibleMarket[3] || [];
            if (visibleT3All.length > 0) return { type: 'RESERVE_CARD', tier: 3, cardId: visibleT3All[0].id };
        }

        if (affordable.length > 0) {
            affordable.sort((a, b) => b.score - a.score);
            const top = affordable[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        return { type: 'PASS' };
    }
}
