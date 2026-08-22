import {
  Exon,
  UTR,
  BaseSequence,
  MutationType,
  Protein,
  ProteinDomain,
  Gene
} from "../core/models.js";

import {
  translate,
  getAminoAcid
} from "../core/translation.js";

function findExonByPositionByGene(nucPos, gene) {
    return binarySearchByPosition(
        gene.base_sequence.exons,
        nucPos,
        exon => exon.start_position,
        exon => exon.end_position
    );
}

function getProteinDomainAtPositionByGene(nucPos, gene) {
    const aaPos = Math.floor(nucPos / 3);
    return binarySearchByPosition(
        gene.protein.domains,
        aaPos,
        dom => dom.start,
        dom => dom.end
    );
}

function truncateAtStopCodon(fullSeq, utr5Len) {
  const protein = translate(fullSeq, utr5Len, fullSeq.length - 1);

  const stopIndex = protein.indexOf('*');

  if (stopIndex === -1) {
    return {
      sequence: fullSeq,
      protein
    };
  }

  const cutLength = utr5Len + stopIndex * 3 + 3;

  return {
    sequence: fullSeq.slice(0, cutLength),
    protein
  };
}

function truncateExonsByLength(exons, maxLen) {
  const result = [];

  for (const exon of exons) {
    if (exon.start_position >= maxLen) {
      break;
    }

    const end = Math.min(exon.end_position, maxLen - 1);
    const length = end - exon.start_position + 1;

    if (length > 0) {
      result.push(
        new Exon({
          number: exon.number,
          start_position: exon.start_position,
          end_position: end,
          length
        })
      );
    }
  }

  return result;
}

function truncateUtrByLength(utr, maxLen) {
  if (
    !utr ||
    utr.start_position == null ||
    utr.start_position < 0 ||
    utr.start_position >= maxLen
  ) {
    return new UTR({
      sequence: '',
      start_position: -1,
      end_position: -1,
      length: 0
    });
  }

  const end = Math.min(utr.end_position, maxLen - 1);
  const length = end - utr.start_position + 1;

  return new UTR({
    sequence: utr.sequence.slice(0, length),
    start_position: utr.start_position,
    end_position: end,
    length
  });
}

function truncateDomainsByProteinLength(domains, proteinLength) {
  const result = [];

  for (const domain of domains) {
    if (domain.start >= proteinLength) {
      continue;
    }

    const end = Math.min(domain.end, proteinLength - 1);

    if (end >= domain.start) {
      result.push(
        new ProteinDomain({
          number: domain.number,
          name: domain.name,
          start: domain.start,
          end,
          type: domain.type
        })
      );
    }
  }

  return result;
}

function translateNucleotidePosition(nucPos1Based, utr5) {
  return nucPos1Based - 1 + utr5.length;
}

function getCodonByNucleotide(utr5Len, seq, cdsPos0Based) {
  const idx = Math.floor(cdsPos0Based / 3) * 3;

  return seq.slice(idx + utr5Len, idx + utr5Len + 3);
}

function binarySearchByPosition(arr, pos, getStart, getEnd) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const item = arr[mid];

    const start = getStart(item);
    const end = getEnd(item);

    if (pos >= start && pos <= end) {
      return item;
    }

    if (pos < start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}

export function findExonByPositionInUI(exons, nucPos) {
  return binarySearchByPosition(
    exons,
    nucPos,
    exon => exon.start_pos,
    exon => exon.end_pos
  );
}

export function getProteinDomainAtCdsPositionInUI(domains, cdsPos0Based) {
  const aaPos = Math.floor(cdsPos0Based / 3);

  return binarySearchByPosition(
    domains,
    aaPos,
    domain => domain.start_aa,
    domain => domain.end_aa
  );
}

function findExonByPositionInGene(exons, nucPos) {
  return binarySearchByPosition(
    exons,
    nucPos,
    exon => exon.start_position,
    exon => exon.end_position
  );
}

function getProteinDomainAtCdsPositionInGene(domains, cdsPos0Based) {
  const aaPos = Math.floor(cdsPos0Based / 3);

  return binarySearchByPosition(
    domains,
    aaPos,
    domain => domain.start,
    domain => domain.end
  );
}

export function applyFind(gene, nucPos1Based) {
  const utr5Len = gene.base_sequence.utr5.length;

  const pos0Based = translateNucleotidePosition(
    nucPos1Based,
    gene.base_sequence.utr5
  );

  const nuc = gene.base_sequence.full_sequence[pos0Based] || "?";

  const exon = findExonByPositionInGene(
    gene.base_sequence.exons,
    pos0Based
  );

  const exonName = exon
    ? `Экзон ${exon.number}`
    : "UTR / Некодирующая область";

  let aa = "-";
  let domainName = "Нет домена";

  const cdsPos0Based = pos0Based - utr5Len;

  if (cdsPos0Based >= 0) {
    const aaIdx = Math.floor(cdsPos0Based / 3);

    aa = gene.protein.sequence[aaIdx] || "-";

    const domain = getProteinDomainAtCdsPositionInGene(
      gene.protein.domains,
      cdsPos0Based
    );

    if (domain) {
      domainName = domain.name;
    }
  }

  return {
    nuc,
    aa,
    exonName,
    domainName
  };
}

export function applySubstitution(gene, nucPos, newNuc) {
  const utr5 = gene.base_sequence.utr5;

  const globalPos = translateNucleotidePosition(nucPos, utr5);

  const seqArr = gene.base_sequence.full_sequence.split('');
  const oldNuc = seqArr[globalPos] || '';

  seqArr[globalPos] = newNuc;

  const mutatedFullSeq = seqArr.join('');

  const codon = getCodonByNucleotide(
    utr5.length,
    mutatedFullSeq,
    nucPos - 1
  );

  const newAa = getAminoAcid(codon);

  const aminoPos = Math.floor((nucPos - 1) / 3);
  const oldAmino = gene.protein.sequence[aminoPos] || '';

  const {
    sequence: finalSeq,
    protein: finalProteinSeq
  } = truncateAtStopCodon(mutatedFullSeq, utr5.length);

  const finalExons = truncateExonsByLength(
    gene.base_sequence.exons,
    finalSeq.length
  );

  const finalUtr5 = truncateUtrByLength(
    gene.base_sequence.utr5,
    finalSeq.length
  );

  const finalUtr3 = truncateUtrByLength(
    gene.base_sequence.utr3,
    finalSeq.length
  );

  const finalDomains = truncateDomainsByProteinLength(
    gene.protein.domains,
    finalProteinSeq.length
  );

  const newBaseSequence = new BaseSequence({
    identifier: gene.base_sequence.identifier,
    length: finalSeq.length,
    exons: finalExons,
    utr5: finalUtr5,
    utr3: finalUtr3,
    full_sequence: finalSeq
  });

  const newProtein = new Protein({
    identifier: gene.protein.identifier,
    sequence: finalProteinSeq,
    length: finalProteinSeq.length,
    domains: finalDomains
  });

  const newGene = new Gene({
    protein: newProtein,
    base_sequence: newBaseSequence
  });

  return {
    newGene,
    newAminoAcid: newAa,
    oldAminoAcid: oldAmino,
    oldNuc
  };
}

export function applyInsertion(gene, insertPos, insertedSeq) {
  const delta = insertedSeq.length;

  const utr5 = gene.base_sequence.utr5;
  const utr3 = gene.base_sequence.utr3;

  const globalPos = translateNucleotidePosition(insertPos, utr5);

  const oldSeq = gene.base_sequence.full_sequence;

  const mutatedFullSeq =
    oldSeq.slice(0, globalPos + 1) +
    insertedSeq +
    oldSeq.slice(globalPos + 1);

  const {
    sequence: finalNewSeq,
    protein: finalProteinSeq
  } = truncateAtStopCodon(mutatedFullSeq, utr5.length);

  const sourceExon = findExonByPositionByGene(globalPos, gene);

  const newExons = [];

  if (sourceExon) {
    for (let i = 0; i < sourceExon.number - 1; i++) {
      newExons.push(structuredClone(gene.base_sequence.exons[i]));
    }

    const mutatedExon = structuredClone(sourceExon);

    mutatedExon.end_position += delta;
    mutatedExon.length += delta;

    newExons.push(mutatedExon);

    for (let i = sourceExon.number; i < gene.base_sequence.exons.length; i++) {
      const exon = structuredClone(gene.base_sequence.exons[i]);

      exon.start_position += delta;
      exon.end_position += delta;

      newExons.push(exon);
    }
  } else {
    for (const exon of gene.base_sequence.exons) {
      newExons.push(structuredClone(exon));
    }
  }

  const finalExons = truncateExonsByLength(
    newExons,
    finalNewSeq.length
  );

  const finalUtr5 = truncateUtrByLength(
    utr5,
    finalNewSeq.length
  );

  const finalUtr3 = truncateUtrByLength(
    utr3,
    finalNewSeq.length
  );

  let diffPos = 0;
  let newDomains = [];

  const cdsPos0Based = insertPos % 3 === 0
    ? insertPos
    : insertPos - 1;

  const mutatedDomain = getProteinDomainAtPositionByGene(
    cdsPos0Based,
    gene
  );

  if (mutatedDomain) {
    const clonedDomain = structuredClone(mutatedDomain);

    const beforeDomains = gene.protein.domains
      .slice(0, clonedDomain.number - 1)
      .map(domain => structuredClone(domain));

    if (clonedDomain.start < finalProteinSeq.length) {
      clonedDomain.end = finalProteinSeq.length - 1;
      clonedDomain.name = `${clonedDomain.name} (mutated)`;

      newDomains = [
        ...beforeDomains,
        clonedDomain
      ];

      const localEnd = clonedDomain.end - clonedDomain.start;

      while (
        diffPos <= localEnd &&
        gene.protein.sequence[diffPos + clonedDomain.start] ===
        finalProteinSeq[diffPos + clonedDomain.start]
      ) {
        diffPos++;
      }
    } else {
      newDomains = beforeDomains;
    }
  } else {
    newDomains = gene.protein.domains.map(
      domain => structuredClone(domain)
    );
  }

  newDomains = truncateDomainsByProteinLength(
    newDomains,
    finalProteinSeq.length
  );

  const newBaseSequence = new BaseSequence({
    identifier: gene.base_sequence.identifier,
    length: finalNewSeq.length,
    exons: finalExons,
    utr5: finalUtr5,
    utr3: finalUtr3,
    full_sequence: finalNewSeq
  });

  const newProtein = new Protein({
    identifier: gene.protein.identifier,
    sequence: finalProteinSeq,
    length: finalProteinSeq.length,
    domains: newDomains
  });

  const newGene = new Gene({
    protein: newProtein,
    base_sequence: newBaseSequence
  });

  return {
    newGene,
    diffPos
  };
}

export function applyDeletion(gene, startPos, endPos) {
  if (endPos < startPos) {
    throw new Error("Конец удаления не может быть меньше начала");
  }

  const delta = endPos - startPos + 1;

  const utr5 = gene.base_sequence.utr5;
  const utr3 = gene.base_sequence.utr3;

  const globalStart = translateNucleotidePosition(startPos, utr5);
  const globalEnd = translateNucleotidePosition(endPos, utr5);

  const oldSeq = gene.base_sequence.full_sequence;

  const delSeq = oldSeq.slice(globalStart, globalEnd + 1);

  const mutatedFullSeq =
    oldSeq.slice(0, globalStart) +
    oldSeq.slice(globalEnd + 1);

  const {
    sequence: finalNewSeq,
    protein: finalProteinSeq
  } = truncateAtStopCodon(mutatedFullSeq, utr5.length);

  const shiftedExons = [];

  for (const exon of gene.base_sequence.exons) {
    const s = exon.start_position;
    const e = exon.end_position;

    const overlapStart = Math.max(s, globalStart);
    const overlapEnd = Math.min(e, globalEnd);
    const overlapLen = Math.max(0, overlapEnd - overlapStart + 1);

    if (overlapLen === 0) {
      if (s > globalEnd) {
        shiftedExons.push(
          new Exon({
            number: exon.number,
            start_position: s - delta,
            end_position: e - delta,
            length: exon.length
          })
        );
      } else {
        shiftedExons.push(
          new Exon({
            number: exon.number,
            start_position: s,
            end_position: e,
            length: exon.length
          })
        );
      }

      continue;
    }

    const remainingLength = exon.length - overlapLen;

    if (remainingLength <= 0) {
      continue;
    }

    let newStart;
    let newEnd;

    if (s < globalStart) {
      newStart = s;
    } else {
      newStart = globalEnd + 1 - delta;
    }

    if (e > globalEnd) {
      newEnd = e - delta;
    } else {
      newEnd = globalStart - 1;
    }

    if (newStart <= newEnd) {
      shiftedExons.push(
        new Exon({
          number: exon.number,
          start_position: newStart,
          end_position: newEnd,
          length: newEnd - newStart + 1
        })
      );
    }
  }

  const finalExons = truncateExonsByLength(
    shiftedExons,
    finalNewSeq.length
  );

  const finalUtr5 = truncateUtrByLength(
    utr5,
    finalNewSeq.length
  );

  const finalUtr3 = truncateUtrByLength(
    utr3,
    finalNewSeq.length
  );

  let diffPos = 0;
  let newDomains = [];

  const mutatedDomain = getProteinDomainAtPositionByGene(
    startPos - 1,
    gene
  );

  if (mutatedDomain) {
    const clonedDomain = structuredClone(mutatedDomain);

    const beforeDomains = gene.protein.domains
      .slice(0, clonedDomain.number - 1)
      .map(domain => structuredClone(domain));

    if (clonedDomain.start < finalProteinSeq.length) {
      clonedDomain.end = finalProteinSeq.length - 1;
      clonedDomain.name = `${clonedDomain.name} (mutated)`;

      newDomains = [
        ...beforeDomains,
        clonedDomain
      ];

      const localEnd = clonedDomain.end - clonedDomain.start;

      while (
        diffPos <= localEnd &&
        gene.protein.sequence[diffPos + clonedDomain.start] ===
        finalProteinSeq[diffPos + clonedDomain.start]
      ) {
        diffPos++;
      }
    } else {
      newDomains = beforeDomains;
    }
  } else {
    newDomains = gene.protein.domains.map(
      domain => structuredClone(domain)
    );
  }

  newDomains = truncateDomainsByProteinLength(
    newDomains,
    finalProteinSeq.length
  );

  const newBaseSequence = new BaseSequence({
    identifier: gene.base_sequence.identifier,
    length: finalNewSeq.length,
    exons: finalExons,
    utr5: finalUtr5,
    utr3: finalUtr3,
    full_sequence: finalNewSeq
  });

  const newProtein = new Protein({
    identifier: gene.protein.identifier,
    sequence: finalProteinSeq,
    length: finalProteinSeq.length,
    domains: newDomains
  });

  const newGene = new Gene({
    protein: newProtein,
    base_sequence: newBaseSequence
  });

  return {
    newGene,
    diffPos,
    delSeq
  };
}