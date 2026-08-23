export class Deck {
    constructor(tier, cards, shouldShuffle = true) {
        this.tier = tier;
        this.cards = cards; // Array of Card objects
        if (shouldShuffle) {
            this.shuffle();
        }
    }

    shuffle() {
        // Standard Fisher-Yates shuffle algorithm
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop() || null; // Returns null if the deck is empty
    }
}
