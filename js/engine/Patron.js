export class Patron {
    constructor(id, points, requirements) {
        this.id = id;
        this.points = points;
        this.requirements = requirements; // e.g., { ruby: 3, emerald: 3 }
    }
}
