import { PATRON_NAMES } from './constants.js';

export class Patron {
    constructor(id, points, requirements, name = '') {
        this.id = id;
        this.points = points;
        this.requirements = requirements; // e.g., { ruby: 3, emerald: 3 }
        this.name = name || PATRON_NAMES[id] || `Noble Patron`;
    }
}
