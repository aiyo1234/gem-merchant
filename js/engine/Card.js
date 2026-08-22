export class Card {
    constructor(id, tier, points, bonus, cost) {
        this.id = id;
        this.tier = tier;
        this.points = points;
        this.bonus = bonus; // The permanent resource discount
        this.cost = cost;   // Object like { ruby: 1, sapphire: 2 }
    }
}
