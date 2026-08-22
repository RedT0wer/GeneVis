import { Exon, UTR, BaseSequence, ProteinDomain, Protein, Gene } from "../core/models.js";
import { translate } from "../core/translation.js";
import { getEnsemblGeneWithExons, getEnsemblSequence, getNcbiData, getUniProtEntry, getUniProtDomains } from "./api.js";

// ---------- Обработка экзонов (Ensembl) ----------
function processEnsemblExons(rawExons) {
    const exons = [];
    let currentPos = 0;
    for (let i = 0; i < rawExons.length; i++) {
        const exonData = rawExons[i];
        const start = currentPos;
        const length = parseInt(exonData.end) - parseInt(exonData.start) + 1;
        const end = start + length - 1;
        const exon = new Exon({
            number: i + 1,
            start_position: start,
            end_position: end,
            length: length
        });
        exons.push(exon);
        currentPos = end + 1;
    }

    return exons;
}

// ---------- Обработка UTR из последовательности (маскировка) ----------
function extractUtrFromSequence(seq) {
    // Определяем 5' UTR: идём с начала, пока символ в нижнем регистре
    let utr5len = 0;
    while (utr5len < seq.length && seq[utr5len] === seq[utr5len].toLowerCase()) utr5len++;
    // Определяем 3' UTR: идём с конца, пока символ в нижнем регистре
    let utr3len = 0;
    while (utr3len < seq.length && seq[seq.length - 1 - utr3len] === seq[seq.length - 1 - utr3len].toLowerCase()) utr3len++;

    const utr5 = new UTR({
        sequence: seq.slice(0, utr5len),
        start_position: 0,
        end_position: utr5len - 1,
        length: utr5len
    });
    const utr3 = new UTR({
        sequence: seq.slice(seq.length - utr3len),
        start_position: seq.length - utr3len,
        end_position: seq.length - 1,
        length: utr3len
    });
    return { utr5, utr3 };
}

// ---------- Построение доменов из UniProt ----------
function buildDomains(proteinSeq, domainsData) {
    const domains = [];
    if (!domainsData || !Array.isArray(domainsData)) return domains;
    for (const { start, end, description } of domainsData) {
        if (start >= proteinSeq.length) continue;
        
        domains.push(new ProteinDomain({
            number: -1,
            name: description,
            start: start,
            end: Math.min(end, proteinSeq.length - 1),
            type: "domain"
        }));
    }
    return domains;
}

// ---------- Трансляция CDS из BaseSequence ----------
function translateCDS(baseSequence) {
    // CDS находится между концом 5' UTR и началом 3' UTR
    const utr5End = baseSequence.utr5.end_position;
    const utr3Start = baseSequence.utr3.start_position;
    let cdsStart = utr5End + 1;
    let cdsEnd = utr3Start - 1;
    // Если UTR не определены, используем всю последовательность
    if (utr5End === -1 || utr3Start === -1) {
        cdsStart = 0;
        cdsEnd = baseSequence.full_sequence.length - 1;
    }
    const cds = baseSequence.full_sequence.slice(cdsStart, cdsEnd + 1);
    // Транслируем CDS в аминокислотную последовательность
    // Функция translate должна быть реализована в translation.js
    return translate(cds, 0, cds.length - 1);
}

// ---------- Построение белка с доменами-соединениями (аналог _translated_base_nucleotide) ----------
function buildTranslatedProteinWithDomains(baseSequence, originalProtein) {
    // 1. Получаем транслированную последовательность из нуклеотидной
    const translatedSeq = translateCDS(baseSequence);

    // 2. Оригинальные домены из UniProt
    const originalDomains = originalProtein.domains || [];

    // 3. Ищем каждый оригинальный домен в транслированной последовательности
    const foundDomains = []; // массив { name, start, end, sequence }
    for (const dom of originalDomains) {
        const seq = originalProtein.sequence.slice(dom.start, Math.min(dom.end, originalProtein.sequence.length - 1));
        const index = translatedSeq.indexOf(seq);
        if (index !== -1) {
            foundDomains.push({
                number: -1,
                name: dom.name,
                start: index,
                end: index + seq.length - 1,
                type: dom.type || "domain",
            });
        }
    }

    // 4. Сортируем найденные домены по начальной координате
    foundDomains.sort((a, b) => a.start - b.start);

    // 5. Создаём итоговый список доменов с добавлением Connection
    const finalDomains = [];
    let lastEnd = -1;

    for (let i = 0; i < foundDomains.length; i++) {
        const dom = foundDomains[i];
        // Добавляем Connection перед текущим доменом, если есть разрыв
        if (lastEnd !== -1 && lastEnd + 1 < dom.start) {
            finalDomains.push(new ProteinDomain({
                number: -1,
                name: "Соединение",
                start: lastEnd + 1,
                end: dom.start - 1,
                type: "Неизвестно",
            }));
        } else if (lastEnd === -1 && dom.start > 0) {
            finalDomains.push(new ProteinDomain({
                number: -1,
                name: "Соединение",
                start: 0,
                end: dom.start - 1,
                type: "Неизвестно",
            }));
        }
        // Добавляем сам домен
        finalDomains.push(new ProteinDomain({
            number: -1,
            name: dom.name,
            start: dom.start,
            end: dom.end,
            type: dom.type,
        }));
        lastEnd = dom.end;
    }

    // Connection в конце, если остались символы
    if (lastEnd !== -1 && lastEnd + 1 < translatedSeq.length) {
        finalDomains.push(new ProteinDomain({
            number: -1,
            name: "Соединение",
            start: lastEnd + 1,
            end: translatedSeq.length - 1,
            type: "Неизвестно",
        }));
    } else if (lastEnd === -1 && translatedSeq.length > 0) {
        // Нет ни одного домена, вся последовательность - Connection
        finalDomains.push(new ProteinDomain({
            number: -1,
            name: "Соединение",
            start: 0,
            end: translatedSeq.length - 1,
            type: "Неизвестно",
        }));
    }

    // 6. Переименовываем Connection домены в стиле "prev -> Connection -> next"
    for (let i = 0; i < finalDomains.length; i++) {
        const domain = finalDomains[i];
        if (domain.name === "Соединение") {
            const parts = [];
            if (i > 0) parts.push(finalDomains[i - 1].name);
            parts.push("Соединение");
            if (i < finalDomains.length - 1) parts.push(finalDomains[i + 1].name);
            domain.name = parts.join(" -> ");
        }
    }

    // 7. 
    for(let i = 0; i < finalDomains.length; i++) {
        const lastDomain = finalDomains[i];
        lastDomain.number = i + 1;
    }

    // 8. Создаём новый объект Protein с транслированной последовательностью и новыми доменами
    return new Protein({
        identifier: baseSequence.identifier,
        sequence: translatedSeq,
        length: translatedSeq.length,
        domains: finalDomains
    });
}

// ---------- Главная сборка гена (Ensembl + UniProt) ----------
export async function buildGeneFromEnsembl(geneId, proteinId) {
    // 1. Получаем данные параллельно
    const [geneData, seqData, uniProtEntry, domainsData] = await Promise.all([
        getEnsemblGeneWithExons(geneId),
        getEnsemblSequence(geneId),
        getUniProtEntry(proteinId),
        getUniProtDomains(proteinId)
    ]);

    // 2. Экзоны
    const rawExons = geneData.Exon || [];
    const exons = processEnsemblExons(rawExons);

    // 3. Полная последовательность и UTR
    const fullSequence = seqData.seq.toUpperCase();
    const { utr5, utr3 } = extractUtrFromSequence(seqData.seq);

    const baseSeq = new BaseSequence({
        identifier: geneId,
        exons: exons,
        utr5: utr5,
        utr3: utr3,
        full_sequence: fullSequence,
        length: fullSequence.length
    });

    // 4. Оригинальный белок из UniProt
    const proteinSeq = uniProtEntry.sequence.value;
    const originalDomains = buildDomains(proteinSeq, domainsData);
    const originalProtein = new Protein({
        identifier: proteinId,
        sequence: proteinSeq,
        domains: originalDomains
    });

    // 5. Строим итоговый белок путём трансляции CDS и поиска доменов с соединениями
    const finalProtein = buildTranslatedProteinWithDomains(baseSeq, originalProtein);

    // 6. Создаём ген
    const gene = new Gene({ protein: finalProtein, base_sequence: baseSeq });
    return gene;
}

// Аналогично для NCBI – упрощённая версия (можно расширить при необходимости)
export async function buildGeneFromNcbi(ncbiId, proteinId) {
    console.warn("NCBI build fallback to Ensembl");
    return buildGeneFromEnsembl(ncbiId, proteinId);
}