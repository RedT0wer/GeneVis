// ---------------------------
// Клиенты внешних API (с повторными попытками + кеш)
// ---------------------------
import { getCached, setCached } from "./cache.js";

const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

async function fetchWithRetry(url, options = {}) {
    for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            if (attempt === RETRY_COUNT - 1) throw e;
            await new Promise(r => setTimeout(r, RETRY_DELAY * Math.pow(2, attempt)));
        }
    }
}

// ----- Ensembl -----
const ENSEMBL_LOOKUP = "https://rest.ensembl.org/lookup/";
const ENSEMBL_SEQ = "https://rest.ensembl.org/sequence/id/";

export async function getEnsemblGeneWithExons(geneId) {
    const cacheKey = `ensembl_exons_${geneId}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const url = `${ENSEMBL_LOOKUP}${geneId}?expand=1;content-type=application/json`;
    const data = await fetchWithRetry(url);
    await setCached(cacheKey, data);
    return data;
}

export async function getEnsemblSequence(identifier) {
    const cacheKey = `ensembl_seq_${identifier}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const url = `${ENSEMBL_SEQ}${identifier}?mask_feature=1;type=cdna;content-type=application/json`;
    const data = await fetchWithRetry(url);
    await setCached(cacheKey, data);
    return data;
}

// ----- NCBI (EUtils) -----
const NCBI_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

export async function getNcbiData(accession) {
    const cacheKey = `ncbi_${accession}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        db: "nuccore",
        id: accession,
        retmode: "xml"
    });
    const url = `${NCBI_URL}?${params}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`NCBI error: ${response.status}`);
    const text = await response.text();
    // Простой парсинг XML в объект (используем DOMParser)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");
    const data = xmlToJson(xmlDoc);
    await setCached(cacheKey, data);
    return data;
}

// вспомогательная функция: XML -> JSON (упрощённая)
function xmlToJson(xml) {
    const obj = {};
    if (xml.nodeType === 1) {
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (let j = 0; j < xml.attributes.length; j++) {
                const attr = xml.attributes.item(j);
                obj["@attributes"][attr.nodeName] = attr.nodeValue;
            }
        }
    } else if (xml.nodeType === 3) {
        return xml.nodeValue;
    }
    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            const item = xml.childNodes.item(i);
            const nodeName = item.nodeName;
            if (typeof obj[nodeName] === "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (!Array.isArray(obj[nodeName])) {
                    obj[nodeName] = [obj[nodeName]];
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    return obj;
}

// ----- UniProt -----
const UNIPROT_URL = "https://rest.uniprot.org/uniprotkb/";

export async function getUniProtEntry(proteinId) {
    const cacheKey = `uniprot_${proteinId}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const url = `${UNIPROT_URL}${proteinId}.json`;
    const data = await fetchWithRetry(url);
    await setCached(cacheKey, data);
    return data;
}

export async function getUniProtDomains(proteinId) {
    const cacheKey = `uniprot_dom_${proteinId}`;
    const cached = await getCached(cacheKey);

    const url = `${UNIPROT_URL}${proteinId}.json?fields=ft_domain,ft_region`;
    const data = await fetchWithRetry(url);

    const features = data.features || [];

    const domains = [];
    for (const feat of features) {
        if (feat.location && (feat.type === "Domain" || feat.type === "Region")) {
            let start = feat.location.start?.value;
            let end = feat.location.end?.value;
            if (start && end) {
                start = start - 1;
                end = end - 1;
                const description = feat.description || feat.type;
                domains.push({ start, end, description });
            }
        }
    }
    await setCached(cacheKey, domains);
    return domains;
}