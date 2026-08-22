export class Exon {
    constructor({ number, start_position, end_position, length }) {
        this.number = number;
        this.start_position = start_position;
        this.end_position = end_position;
        this.length = length;
    }
}

export class UTR {
    constructor({ sequence, start_position, end_position, length }) {
        this.sequence = sequence;
        this.start_position = start_position;
        this.end_position = end_position;
        this.length = length || sequence.length;
    }
}

export class BaseSequence {
    constructor({ identifier, length, exons, utr5, utr3, full_sequence }) {
        this.identifier = identifier;
        this.length = length || exons.reduce((s, e) => s + e.length, 0);
        this.exons = exons;
        this.utr5 = utr5;
        this.utr3 = utr3;
        this.full_sequence = full_sequence;
    }
}

export class ProteinDomain {
    constructor({ number, name, start, end, type = "domain" }) {
        this.number = number;
        this.name = name;
        this.start = start;
        this.end = end;
        this.type = type;
    }
}

export class Protein {
    constructor({ identifier, sequence, length, domains }) {
        this.identifier = identifier;
        this.sequence = sequence;
        this.length = length || sequence.length;
        this.domains = domains;
    }
}

export class Gene {
    constructor({ protein, base_sequence }) {
        this.protein = protein;
        this.base_sequence = base_sequence;
    }
}

export const MutationType = {
    SUBSTITUTION: "substitution",
    INSERTION: "insertion",
    DELETION: "deletion"
};