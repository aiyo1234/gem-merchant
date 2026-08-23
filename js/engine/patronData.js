export function getInitialPatrons() {
    return [
        // 5 Dual-Requirement Nobles (4 of two different gem types, 3 Points each)
        { id: 'patron_1', points: 3, requirements: { ruby: 4, emerald: 4 } },
        { id: 'patron_2', points: 3, requirements: { sapphire: 4, emerald: 4 } },
        { id: 'patron_3', points: 3, requirements: { pearl: 4, sapphire: 4 } },
        { id: 'patron_4', points: 3, requirements: { pearl: 4, onyx: 4 } },
        { id: 'patron_5', points: 3, requirements: { ruby: 4, onyx: 4 } },

        // 5 Tri-Requirement Nobles (3 of three different gem types, 3 Points each)
        { id: 'patron_6', points: 3, requirements: { pearl: 3, sapphire: 3, onyx: 3 } },
        { id: 'patron_7', points: 3, requirements: { pearl: 3, emerald: 3, ruby: 3 } },
        { id: 'patron_8', points: 3, requirements: { sapphire: 3, emerald: 3, ruby: 3 } },
        { id: 'patron_9', points: 3, requirements: { sapphire: 3, emerald: 3, onyx: 3 } },
        { id: 'patron_10', points: 3, requirements: { pearl: 3, ruby: 3, onyx: 3 } }
    ];
}
