export function getInitialPatrons() {
    return [
        { id: 'patron_1', points: 3, requirements: { ruby: 4, sapphire: 4 } },
        { id: 'patron_2', points: 3, requirements: { emerald: 4, onyx: 4 } },
        { id: 'patron_3', points: 3, requirements: { ruby: 3, sapphire: 3, emerald: 3 } },
        { id: 'patron_4', points: 3, requirements: { sapphire: 4, onyx: 4 } },
        { id: 'patron_5', points: 3, requirements: { ruby: 4, emerald: 4 } }
    ];
}
