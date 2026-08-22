export function getInitialCards() {
    return [
        // ================= TIER 1 CARDS (40 Cards total) =================
        // White (Pearl) Bonus
        { id: 't1_1', tier: 1, points: 0, bonus: 'pearl', cost: { onyx: 1, sapphire: 1, emerald: 1, ruby: 1 } },
        { id: 't1_2', tier: 1, points: 0, bonus: 'pearl', cost: { sapphire: 2, emerald: 2 } },
        { id: 't1_3', tier: 1, points: 0, bonus: 'pearl', cost: { sapphire: 1, onyx: 2, ruby: 2 } },
        { id: 't1_4', tier: 1, points: 0, bonus: 'pearl', cost: { emerald: 3 } },
        { id: 't1_5', tier: 1, points: 0, bonus: 'pearl', cost: { onyx: 2, ruby: 1 } },
        { id: 't1_6', tier: 1, points: 0, bonus: 'pearl', cost: { ruby: 4 } },
        { id: 't1_7', tier: 1, points: 0, bonus: 'pearl', cost: { sapphire: 1, emerald: 1, onyx: 1, ruby: 1 } },
        { id: 't1_8', tier: 1, points: 1, bonus: 'pearl', cost: { onyx: 4 } },

        // Sapphire (Blue) Bonus
        { id: 't1_9', tier: 1, points: 0, bonus: 'sapphire', cost: { pearl: 1, emerald: 1, onyx: 1, ruby: 1 } },
        { id: 't1_10', tier: 1, points: 0, bonus: 'sapphire', cost: { pearl: 2, onyx: 2 } },
        { id: 't1_11', tier: 1, points: 0, bonus: 'sapphire', cost: { pearl: 2, emerald: 1, ruby: 2 } },
        { id: 't1_12', tier: 1, points: 0, bonus: 'sapphire', cost: { ruby: 3 } },
        { id: 't1_13', tier: 1, points: 0, bonus: 'sapphire', cost: { pearl: 1, ruby: 2 } },
        { id: 't1_14', tier: 1, points: 0, bonus: 'sapphire', cost: { pearl: 4 } },
        { id: 't1_15', tier: 1, points: 0, bonus: 'sapphire', cost: { pearl: 1, emerald: 1, onyx: 1, ruby: 1 } },
        { id: 't1_16', tier: 1, points: 1, bonus: 'sapphire', cost: { pearl: 4 } },

        // Emerald (Green) Bonus
        { id: 't1_17', tier: 1, points: 0, bonus: 'emerald', cost: { pearl: 1, sapphire: 1, onyx: 1, ruby: 1 } },
        { id: 't1_18', tier: 1, points: 0, bonus: 'emerald', cost: { pearl: 2, sapphire: 2 } },
        { id: 't1_19', tier: 1, points: 0, bonus: 'emerald', cost: { pearl: 2, sapphire: 2, onyx: 1 } },
        { id: 't1_20', tier: 1, points: 0, bonus: 'emerald', cost: { pearl: 3 } },
        { id: 't1_21', tier: 1, points: 0, bonus: 'emerald', cost: { sapphire: 2, onyx: 1 } },
        { id: 't1_22', tier: 1, points: 0, bonus: 'emerald', cost: { sapphire: 4 } },
        { id: 't1_23', tier: 1, points: 0, bonus: 'emerald', cost: { pearl: 1, sapphire: 1, onyx: 1, ruby: 1 } },
        { id: 't1_24', tier: 1, points: 1, bonus: 'emerald', cost: { sapphire: 4 } },

        // Ruby (Red) Bonus
        { id: 't1_25', tier: 1, points: 0, bonus: 'ruby', cost: { pearl: 1, sapphire: 1, emerald: 1, onyx: 1 } },
        { id: 't1_26', tier: 1, points: 0, bonus: 'ruby', cost: { pearl: 2, onyx: 2 } },
        { id: 't1_27', tier: 1, points: 0, bonus: 'ruby', cost: { pearl: 1, emerald: 2, onyx: 2 } },
        { id: 't1_28', tier: 1, points: 0, bonus: 'ruby', cost: { pearl: 3 } },
        { id: 't1_29', tier: 1, points: 0, bonus: 'ruby', cost: { emerald: 2, pearl: 1 } },
        { id: 't1_30', tier: 1, points: 0, bonus: 'ruby', cost: { emerald: 4 } },
        { id: 't1_31', tier: 1, points: 0, bonus: 'ruby', cost: { pearl: 1, sapphire: 1, emerald: 1, onyx: 1 } },
        { id: 't1_32', tier: 1, points: 1, bonus: 'ruby', cost: { emerald: 4 } },

        // Onyx (Black) Bonus
        { id: 't1_33', tier: 1, points: 0, bonus: 'onyx', cost: { pearl: 1, sapphire: 1, emerald: 1, ruby: 1 } },
        { id: 't1_34', tier: 1, points: 0, bonus: 'onyx', cost: { sapphire: 2, ruby: 2 } },
        { id: 't1_35', tier: 1, points: 0, bonus: 'onyx', cost: { pearl: 2, sapphire: 1, ruby: 2 } },
        { id: 't1_36', tier: 1, points: 0, bonus: 'onyx', cost: { ruby: 3 } },
        { id: 't1_37', tier: 1, points: 0, bonus: 'onyx', cost: { pearl: 2, ruby: 1 } },
        { id: 't1_38', tier: 1, points: 0, bonus: 'onyx', cost: { pearl: 4 } },
        { id: 't1_39', tier: 1, points: 0, bonus: 'onyx', cost: { pearl: 1, sapphire: 1, emerald: 1, ruby: 1 } },
        { id: 't1_40', tier: 1, points: 1, bonus: 'onyx', cost: { ruby: 4 } },


        // ================= TIER 2 CARDS (30 Cards total) =================
        { id: 't2_1', tier: 2, points: 1, bonus: 'pearl', cost: { pearl: 3, sapphire: 2, emerald: 3 } },
        { id: 't2_2', tier: 2, points: 1, bonus: 'pearl', cost: { pearl: 2, onyx: 4, ruby: 1 } },
        { id: 't2_3', tier: 2, points: 2, bonus: 'pearl', cost: { emerald: 5 } },
        { id: 't2_4', tier: 2, points: 2, bonus: 'pearl', cost: { emerald: 5, onyx: 3 } },
        { id: 't2_5', tier: 2, points: 2, bonus: 'pearl', cost: { sapphire: 5, ruby: 3 } },
        { id: 't2_6', tier: 2, points: 3, bonus: 'pearl', cost: { pearl: 6 } },

        { id: 't2_7', tier: 2, points: 1, bonus: 'sapphire', cost: { pearl: 3, sapphire: 3, ruby: 2 } },
        { id: 't2_8', tier: 2, points: 1, bonus: 'sapphire', cost: { pearl: 1, sapphire: 2, onyx: 4 } },
        { id: 't2_9', tier: 2, points: 2, bonus: 'sapphire', cost: { ruby: 5 } },
        { id: 't2_10', tier: 2, points: 2, bonus: 'sapphire', cost: { pearl: 3, ruby: 5 } },
        { id: 't2_11', tier: 2, points: 2, bonus: 'sapphire', cost: { emerald: 5, sapphire: 3 } },
        { id: 't2_12', tier: 2, points: 3, bonus: 'sapphire', cost: { sapphire: 6 } },

        { id: 't2_13', tier: 2, points: 1, bonus: 'emerald', cost: { sapphire: 3, emerald: 2, onyx: 3 } },
        { id: 't2_14', tier: 2, points: 1, bonus: 'emerald', cost: { pearl: 4, emerald: 1, ruby: 2 } },
        { id: 't2_15', tier: 2, points: 2, bonus: 'emerald', cost: { pearl: 5 } },
        { id: 't2_16', tier: 2, points: 2, bonus: 'emerald', cost: { pearl: 5, sapphire: 3 } },
        { id: 't2_17', tier: 2, points: 2, bonus: 'emerald', cost: { onyx: 5, ruby: 3 } },
        { id: 't2_18', tier: 2, points: 3, bonus: 'emerald', cost: { emerald: 6 } },

        { id: 't2_19', tier: 2, points: 1, bonus: 'ruby', cost: { pearl: 2, onyx: 3, ruby: 3 } },
        { id: 't2_20', tier: 2, points: 1, bonus: 'ruby', cost: { sapphire: 4, emerald: 2, ruby: 1 } },
        { id: 't2_21', tier: 2, points: 2, bonus: 'ruby', cost: { onyx: 5 } },
        { id: 't2_22', tier: 2, points: 2, bonus: 'ruby', cost: { sapphire: 5, onyx: 3 } },
        { id: 't2_23', tier: 2, points: 2, bonus: 'ruby', cost: { pearl: 5, emerald: 3 } },
        { id: 't2_24', tier: 2, points: 3, bonus: 'ruby', cost: { ruby: 6 } },

        { id: 't2_25', tier: 2, points: 1, bonus: 'onyx', cost: { pearl: 2, sapphire: 3, onyx: 2 } },
        { id: 't2_26', tier: 2, points: 1, bonus: 'onyx', cost: { emerald: 4, onyx: 1, ruby: 2 } },
        { id: 't2_27', tier: 2, points: 2, bonus: 'onyx', cost: { sapphire: 5 } },
        { id: 't2_28', tier: 2, points: 2, bonus: 'onyx', cost: { pearl: 3, sapphire: 5 } },
        { id: 't2_29', tier: 2, points: 2, bonus: 'onyx', cost: { emerald: 5, ruby: 3 } },
        { id: 't2_30', tier: 2, points: 3, bonus: 'onyx', cost: { onyx: 6 } },


        // ================= TIER 3 CARDS (20 Cards total) =================
        { id: 't3_1', tier: 3, points: 3, bonus: 'pearl', cost: { pearl: 3, sapphire: 3, emerald: 3, onyx: 5 } },
        { id: 't3_2', tier: 3, points: 4, bonus: 'pearl', cost: { pearl: 7 } },
        { id: 't3_3', tier: 3, points: 4, bonus: 'pearl', cost: { pearl: 6, onyx: 3 } },
        { id: 't3_4', tier: 3, points: 5, bonus: 'pearl', cost: { pearl: 7, onyx: 3 } },

        { id: 't3_5', tier: 3, points: 3, bonus: 'sapphire', cost: { pearl: 3, sapphire: 3, ruby: 3, onyx: 5 } },
        { id: 't3_6', tier: 3, points: 4, bonus: 'sapphire', cost: { sapphire: 7 } },
        { id: 't3_7', tier: 3, points: 4, bonus: 'sapphire', cost: { sapphire: 6, pearl: 3 } },
        { id: 't3_8', tier: 3, points: 5, bonus: 'sapphire', cost: { sapphire: 7, pearl: 3 } },

        { id: 't3_9', tier: 3, points: 3, bonus: 'emerald', cost: { pearl: 5, sapphire: 3, emerald: 3, ruby: 3 } },
        { id: 't3_10', tier: 3, points: 4, bonus: 'emerald', cost: { emerald: 7 } },
        { id: 't3_11', tier: 3, points: 4, bonus: 'emerald', cost: { emerald: 6, sapphire: 3 } },
        { id: 't3_12', tier: 3, points: 5, bonus: 'emerald', cost: { emerald: 7, sapphire: 3 } },

        { id: 't3_13', tier: 3, points: 3, bonus: 'ruby', cost: { sapphire: 5, emerald: 3, ruby: 3, onyx: 3 } },
        { id: 't3_14', tier: 3, points: 4, bonus: 'ruby', cost: { ruby: 7 } },
        { id: 't3_15', tier: 3, points: 4, bonus: 'ruby', cost: { ruby: 6, emerald: 3 } },
        { id: 't3_16', tier: 3, points: 5, bonus: 'ruby', cost: { ruby: 7, emerald: 3 } },

        { id: 't3_17', tier: 3, points: 3, bonus: 'onyx', cost: { pearl: 3, emerald: 5, ruby: 3, onyx: 3 } },
        { id: 't3_18', tier: 3, points: 4, bonus: 'onyx', cost: { onyx: 7 } },
        { id: 't3_19', tier: 3, points: 4, bonus: 'onyx', cost: { onyx: 6, ruby: 3 } },
        { id: 't3_20', tier: 3, points: 5, bonus: 'onyx', cost: { onyx: 7, ruby: 3 } }
    ];
}