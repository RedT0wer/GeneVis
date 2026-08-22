const CODON_TABLE = {
    'TTT':'F', 'TTC':'F', 'TTA':'L', 'TTG':'L',
    'TCT':'S', 'TCC':'S', 'TCA':'S', 'TCG':'S',
    'TAT':'Y', 'TAC':'Y', 'TAA':'*', 'TAG':'*',
    'TGT':'C', 'TGC':'C', 'TGA':'*', 'TGG':'W',
    'CTT':'L', 'CTC':'L', 'CTA':'L', 'CTG':'L',
    'CCT':'P', 'CCC':'P', 'CCA':'P', 'CCG':'P',
    'CAT':'H', 'CAC':'H', 'CAA':'Q', 'CAG':'Q',
    'CGT':'R', 'CGC':'R', 'CGA':'R', 'CGG':'R',
    'ATT':'I', 'ATC':'I', 'ATA':'I', 'ATG':'M',
    'ACT':'T', 'ACC':'T', 'ACA':'T', 'ACG':'T',
    'AAT':'N', 'AAC':'N', 'AAA':'K', 'AAG':'K',
    'AGT':'S', 'AGC':'S', 'AGA':'R', 'AGG':'R',
    'GTT':'V', 'GTC':'V', 'GTA':'V', 'GTG':'V',
    'GCT':'A', 'GCC':'A', 'GCA':'A', 'GCG':'A',
    'GAT':'D', 'GAC':'D', 'GAA':'E', 'GAG':'E',
    'GGT':'G', 'GGC':'G', 'GGA':'G', 'GGG':'G'
};

export function getAminoAcid(codon) {
    return CODON_TABLE[codon.toUpperCase()] || 'X';
}

/**
 * Транслирует последовательность ДНК в белок
 * @param {string} sequence - ДНК строка
 * @param {number} start - индекс первого нуклеотида (0-based)
 * @param {number} end - индекс последнего нуклеотида (0-based)
 * @returns {string} аминокислотная последовательность (останавливается на стоп-кодоне)
 */
export function translate(sequence, start, end) {
    let protein = "";
    for (let i = start; i + 2 <= end; i += 3) {
        const codon = sequence.slice(i, i + 3);
        const aa = getAminoAcid(codon);
        protein += aa;
        if (aa === '*') break;
    }
    return protein;
}