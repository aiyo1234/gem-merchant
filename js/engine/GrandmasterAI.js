import { RuleEngine } from './RuleEngine.js';
import { RESOURCES, RULES } from './constants.js';

export class GrandmasterAI {
    /**
     * SUPERHUMAN GRANDMASTER ENGINE (v11.0)
     * 1. Goal-Oriented Turn-Distance Planning (calculateTurnsToCard with bank & gold awareness)
     * 2. Point Velocity Ranking (Prestige Points / Turns to Acquire)
     * 3. Engine Velocity for Tier 1 Cards (Only buy if it accelerates target high-tier cards)
     * 4. Opponent Threat Tracking & Emergency Hate-Draft Reserving
     * 5. Stack-Dropping Token Starvation (Drop 4-token bank stacks to 3)
     */
    static computeBestAction(game, aiPlayer) {
        try {
            return this.computeSuperhumanAction(game, aiPlayer);
        } catch (e) {
            return { type: 'PASS' };
        }
    }

    static computeBestActionWithWeights(game, aiPlayer, w) {
        return this.computeSuperhumanAction(game, aiPlayer);
    }

    static calculateTurnsToCard(player, card, bank) {
        let totalMissing = 0;
        let bankDeficit = 0;
        for (const [gem, cost] of Object.entries(card.cost || {})) {
            const discount = player.bonuses[gem] || 0;
            const netCost = Math.max(0, cost - discount);
            const tokensHave = player.tokens[gem] || 0;
            const deficit = Math.max(0, netCost - tokensHave);
            if (deficit > 0) {
                totalMissing += deficit;
                const inBank = bank[gem] || 0;
                if (inBank < deficit) bankDeficit += (deficit - inBank);
            }
        }
        const gold = player.tokens['gold'] || 0;
        totalMissing = Math.max(0, totalMissing - gold);
        if (totalMissing === 0) return 1;
        const tokenTurns = Math.ceil(totalMissing / 2.5) + bankDeficit;
        return tokenTurns + 1;
    }

    static computeSuperhumanAction(game, aiPlayer) {
        if (!game || !aiPlayer || game.isGameOver) return { type: 'PASS' };

        const bank = game.bank.tokens;
        const patrons = game.availablePatrons || [];
        const opponents = game.players.filter(p => p !== aiPlayer);
        const canReserve = (aiPlayer.reservedCards || []).length < 3;
        const bankHasGold = (bank[RESOURCES.GOLD] || 0) > 0;

        // ==============================================================
        // 1. OPPONENT THREAT TRACKING & DEFENSIVE HATE-DRAFTING
        // ==============================================================
        for (const opp of opponents) {
            for (let t = 2; t <= 3; t++) {
                for (const card of (game.visibleMarket[t] || [])) {
                    try {
                        RuleEngine.calculateActualCost(opp, card.cost);
                        const simBonuses = { ...opp.bonuses, [card.bonus]: (opp.bonuses[card.bonus] || 0) + 1 };
                        let extraPatronPts = 0;
                        patrons.forEach(p => {
                            if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                                extraPatronPts += p.points;
                            }
                        });
                        if (opp.prestige + card.points + extraPatronPts >= RULES.VICTORY_THRESHOLD && canReserve && bankHasGold) {
                            return { type: 'RESERVE_CARD', tier: t, cardId: card.id };
                        }
                    } catch (e) {}
                }
            }
        }

        // ==============================================================
        // 2. POINT VELOCITY RANKING: Find Top Target Cards
        // ==============================================================
        const allMarketPointCards = [];
        for (let t = 3; t >= 1; t--) {
            (game.visibleMarket[t] || []).forEach(card => {
                const turns = this.calculateTurnsToCard(aiPlayer, card, bank);
                const simBonuses = { ...aiPlayer.bonuses, [card.bonus]: (aiPlayer.bonuses[card.bonus] || 0) + 1 };
                let patronReward = 0;
                patrons.forEach(p => {
                    if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                        patronReward += p.points;
                    }
                });
                const totalPoints = card.points + patronReward;
                const velocity = (Math.pow(Math.max(0.1, totalPoints), 1.1) * 10.0 + 0.1) / turns;
                allMarketPointCards.push({ card, tier: t, isReserved: false, turns, totalPoints, velocity });
            });
        }

        (aiPlayer.reservedCards || []).forEach(card => {
            const turns = this.calculateTurnsToCard(aiPlayer, card, bank);
            const simBonuses = { ...aiPlayer.bonuses, [card.bonus]: (aiPlayer.bonuses[card.bonus] || 0) + 1 };
            let patronReward = 0;
            patrons.forEach(p => {
                if (Object.entries(p.requirements).every(([res, req]) => (simBonuses[res] || 0) >= req)) {
                    patronReward += p.points;
                }
            });
            const totalPoints = card.points + patronReward;
            const velocity = (Math.pow(Math.max(0.1, totalPoints), 1.1) * 12.0 + 0.1) / turns;
            allMarketPointCards.push({ card, tier: card.tier, isReserved: true, turns, totalPoints, velocity });
        });

        allMarketPointCards.sort((a, b) => b.velocity - a.velocity || b.totalPoints - a.totalPoints);
        const primaryTarget = allMarketPointCards[0] || null;
        const secondaryTarget = allMarketPointCards[1] || null;

        // ==============================================================
        // 3. EVALUATE AFFORDABLE PURCHASES (ENGINE VELOCITY FIRST)
        // ==============================================================
        const affordable = [];
        const allCards = [];
        for (let t = 3; t >= 1; t--) {
            (game.visibleMarket[t] || []).forEach(card => allCards.push({ card, tier: t, isReserved: false }));
        }
        (aiPlayer.reservedCards || []).forEach(card => allCards.push({ card, tier: card.tier, isReserved: true }));

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

                let engineVelocity = 0;
                if (primaryTarget && (primaryTarget.card.cost[item.card.bonus] || 0) > 0) engineVelocity += 3;
                if (secondaryTarget && (secondaryTarget.card.cost[item.card.bonus] || 0) > 0) engineVelocity += 2;

                let score = (totalPoints * 600.0) + (item.card.points * 250.0) + (patronReward * 450.0) - (netTokens * 15.0) + (engineVelocity * 35.0);
                if (netTokens === 0) score += 70.0;

                affordable.push({ ...item, totalPoints, patronReward, netTokens, wins, score, engineVelocity });
            } catch (e) {}
        }

        // TACTIC 1: Instant Victory Purchase
        const winBuy = affordable.find(a => a.wins);
        if (winBuy) return winBuy.isReserved ? { type: 'BUY_RESERVED', cardId: winBuy.card.id } : { type: 'BUY_CARD', tier: winBuy.tier, cardId: winBuy.card.id };

        // TACTIC 2: Buy High-Prestige Cards (>= 2 Points)
        const bigBuys = affordable.filter(a => a.totalPoints >= 2);
        if (bigBuys.length > 0) {
            bigBuys.sort((a, b) => b.score - a.score);
            const top = bigBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 3: Buy 1-Point Cards
        const oneBuys = affordable.filter(a => a.totalPoints >= 1);
        if (oneBuys.length > 0) {
            oneBuys.sort((a, b) => b.score - a.score);
            const top = oneBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 4: Buy Free Synergistic Cards
        const freeBuys = affordable.filter(a => a.netTokens === 0 && (a.totalPoints > 0 || a.engineVelocity > 0));
        if (freeBuys.length > 0) {
            freeBuys.sort((a, b) => b.score - a.score);
            const top = freeBuys[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // TACTIC 5: Engine Building Tier 1 Cards (Only if high engine velocity & early game)
        if (aiPlayer.purchasedCards.length < 4 && aiPlayer.prestige < 3) {
            const engineBuys = affordable.filter(a => a.tier === 1 && a.netTokens <= 2 && a.engineVelocity > 0);
            if (engineBuys.length > 0) {
                engineBuys.sort((a, b) => b.score - a.score);
                const top = engineBuys[0];
                return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
            }
        }

        // TACTIC 6: Anti-Stall Token Flush (8+ tokens)
        if (affordable.length > 0 && aiPlayer.getTotalTokenCount() >= 8) {
            affordable.sort((a, b) => b.score - a.score);
            const top = affordable[0];
            return top.isReserved ? { type: 'BUY_RESERVED', cardId: top.card.id } : { type: 'BUY_CARD', tier: top.tier, cardId: top.card.id };
        }

        // ==============================================================
        // 4. STRATEGIC GOLD WILDCARD RESERVATION (LOCK TOP VELOCITY CARD)
        // ==============================================================
        if (primaryTarget && !primaryTarget.isReserved && primaryTarget.card.points >= 3 && canReserve && bankHasGold && (aiPlayer.reservedCards || []).length < 2) {
            if (aiPlayer.purchasedCards.length >= 1 || primaryTarget.card.points >= 4) {
                return { type: 'RESERVE_CARD', tier: primaryTarget.tier, cardId: primaryTarget.card.id };
            }
        }

        // ==============================================================
        // 5. TOKEN DEFICIT DRAFTING & STACK-DROPPING DENIAL
        // ==============================================================
        const deficits = {};
        if (primaryTarget) {
            for (const [r, amt] of Object.entries(primaryTarget.card.cost)) {
                const need = Math.max(0, amt - (aiPlayer.bonuses[r] || 0));
                const have = aiPlayer.tokens[r] || 0;
                if (have < need) deficits[r] = (deficits[r] || 0) + (need - have) * 3;
            }
        }
        if (secondaryTarget) {
            for (const [r, amt] of Object.entries(secondaryTarget.card.cost)) {
                const need = Math.max(0, amt - (aiPlayer.bonuses[r] || 0));
                const have = aiPlayer.tokens[r] || 0;
                if (have < need) deficits[r] = (deficits[r] || 0) + (need - have);
            }
        }

        for (const [r, count] of Object.entries(deficits)) {
            if ((bank[r] || 0) >= 4 && count >= 3 && aiPlayer.getTotalTokenCount() <= 8) {
                return { type: 'TAKE_TWO', resource: r };
            }
        }

        // Stack-Dropping Denial: Drop bank from 4 to 3 to block opponent double take
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
        for (const [r, count] of Object.entries(deficits)) combinedNeeds[r] = (combinedNeeds[r] || 0) + (count * 10);
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
