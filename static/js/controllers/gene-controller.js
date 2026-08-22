import {
  buildGeneFromEnsembl,
  buildGeneFromNcbi
} from '../data/gene-builder.js';

import {
  applySubstitution,
  applyInsertion,
  applyDeletion,
  applyFind
} from '../mutations/mutation-engine.js';

import {
  state,
  nextGeneVersion,
  clearExpandedCards,
  resetRenderState
} from '../core/state.js';

import {
  renderExonsView,
  renderDomainsView,
  updateStats,
  showMutationResult
} from '../views/components.js';

export class GeneController {
  get currentGene() {
    return state.mutatedGene || state.originalGene;
  }

  get originalGene() {
    return state.originalGene;
  }

  async loadGene(geneId, proteinId, source) {
    let gene;

    if (source === 'ensembl') {
      gene = await buildGeneFromEnsembl(geneId, proteinId);
    } else {
      gene = await buildGeneFromNcbi(geneId, proteinId);
    }

    nextGeneVersion();
    clearExpandedCards();
    resetRenderState();

    state.originalGene = gene;
    state.mutatedGene = null;

    state.originalUI = this._convertGeneToUI(gene);

    state.mutatedUI = {
      exons: [],
      domains: []
    };

    state.uiMode = 'original';
    state.mutationSession = null;

    this.refreshUI();
    updateStats(state.originalGene);

    return gene;
  }

  resetGene() {
    if (!state.originalGene) {
      showMutationResult('Нет исходного гена...', true);
      return;
    }

    state.mutatedGene = null;

    state.mutatedUI = {
      exons: [],
      domains: []
    };

    state.mutationSession = null;
    state.uiMode = 'original';

    clearExpandedCards();
    resetRenderState();

    this.refreshUI();

    showMutationResult('<p>Ген успешно сброшен.</p>', false);
  }

  applyMutation(type, params) {
    if (!state.originalGene) {
      showMutationResult("Сначала постройте ген", true);
      return;
    }

    const originalGene = state.originalGene;

    try {
      let newGene = null;
      let displayData = {};

      switch (type) {
        case 'find': {
          const pos = parseInt(params.pos);

          if (
            isNaN(pos) ||
            pos < 1 ||
            pos > originalGene.base_sequence.full_sequence.length
          ) {
            throw new Error("Неверная позиция");
          }

          const res = applyFind(originalGene, pos);

          const targetPos =
            pos + parseInt(originalGene.base_sequence.utr5.length);

          displayData = {
            pos: targetPos,
            ...res
          };

          break;
        }

        case 'substitution': {
          const subPos = parseInt(params.pos);
          const newNuc = params.newNuc.trim().toUpperCase();

          if (!"ATCG".includes(newNuc)) {
            throw new Error("Неверный нуклеотид");
          }

          const subRes = applySubstitution(
            originalGene,
            subPos,
            newNuc
          );

          newGene = subRes.newGene;

          const targetSubPos =
            subPos + parseInt(originalGene.base_sequence.utr5.length);

          displayData = {
            pos: targetSubPos,
            oldNuc: subRes.oldNuc,
            newNuc: newNuc,
            newAminoAcid: subRes.newAminoAcid,
            oldAminoAcid: subRes.oldAminoAcid
          };

          break;
        }

        case 'insertion': {
          const insPos = parseInt(params.pos);
          const insSeq = params.seq.trim().toUpperCase();

          if (!/^[ATCG]+$/.test(insSeq)) {
            throw new Error(
              "Неверная последовательность для вставки (допустимы только A, T, C, G)"
            );
          }

          if (isNaN(insPos) || insPos < 1) {
            throw new Error("Неверная позиция для вставки");
          }

          const insRes = applyInsertion(
            originalGene,
            insPos,
            insSeq
          );

          newGene = insRes.newGene;

          const targetInsPos =
            insPos + parseInt(originalGene.base_sequence.utr5.length);

          displayData = {
            pos: targetInsPos,
            seq: insSeq,
            diffPos: insRes.diffPos + 1
          };

          break;
        }

        case 'deletion': {
          const delStart = parseInt(params.start);
          const delEnd = parseInt(params.end);

          const delRes = applyDeletion(
            originalGene,
            delStart,
            delEnd
          );

          newGene = delRes.newGene;

          const targetDelStartPos =
            delStart + parseInt(originalGene.base_sequence.utr5.length);

          displayData = {
            pos: targetDelStartPos,
            start: delStart,
            end: delEnd,
            diffPos: delRes.diffPos + 1,
            delSeq: delRes.delSeq
          };

          break;
        }

        default: {
          throw new Error("Неизвестный тип мутации");
        }
      }

      if (newGene) {
        state.mutatedGene = newGene;
        state.mutatedUI = this._convertGeneToUI(newGene);
        state.uiMode = type === 'find' ? 'original' : 'mutation-preview';
      } else {
        state.mutatedGene = null;

        state.mutatedUI = {
          exons: [],
          domains: []
        };

        state.uiMode = 'original';
      }

      state.mutationSession = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        ...displayData,
        gene: newGene || originalGene
      };

      this._showMutationResultUI(type, displayData);
    } catch (err) {
      showMutationResult(
        `<p><img src="./static/icons/xmark.svg" width="24" height="24"> Ошибка: ${err.message}</p>`,
        true
      );
    }
  }

  refreshUI() {
    renderExonsView();
    renderDomainsView();
  }

  _convertGeneToUI(gene) {
    const exonsUI = [];

    const utr5 = gene.base_sequence.utr5;
    const utr3 = gene.base_sequence.utr3;

    let globalCdsOffset = 0;

    for (let i = 0; i < gene.base_sequence.exons.length; i++) {
      const exon = gene.base_sequence.exons[i];

      const exonStart = exon.start_position;
      const exonEnd = exon.end_position;
      const exonLength = exon.length;

      let utr5Len = 0;

      if (utr5 && utr5.end_position >= 0) {
        const overlapStart = Math.max(exonStart, utr5.start_position);
        const overlapEnd = Math.min(exonEnd, utr5.end_position);

        if (overlapEnd >= overlapStart) {
          utr5Len = overlapEnd - overlapStart + 1;
        }
      }

      let utr3Len = 0;

      if (utr3 && utr3.start_position >= 0) {
        const overlapStart = Math.max(exonStart, utr3.start_position);
        const overlapEnd = Math.min(exonEnd, utr3.end_position);

        if (overlapEnd >= overlapStart) {
          utr3Len = overlapEnd - overlapStart + 1;
        }
      }

      const cdsLen = Math.max(0, exonLength - utr5Len - utr3Len);

      const exonSeq = gene.base_sequence.full_sequence.slice(
        exonStart,
        exonEnd + 1
      );

      let cdsStart1Based = 0;
      let cdsEnd1Based = 0;

      if (cdsLen > 0) {
        cdsStart1Based = globalCdsOffset + 1;
        cdsEnd1Based = globalCdsOffset + cdsLen;
        globalCdsOffset += cdsLen;
      }

      exonsUI.push({
        id: i + 1,
        name: `Экзон ${i + 1}`,
        start_pos: exonStart,
        end_pos: exonEnd,
        length: exonLength,
        utr5_len: utr5Len,
        cds_len: cdsLen,
        utr3_len: utr3Len,
        cds_start_1based: cdsStart1Based,
        cds_end_1based: cdsEnd1Based,
        sequence: exonSeq
      });
    }

    const domainsUI = gene.protein.domains.map((dom, i) => ({
      id: i + 1,
      name: dom.name,
      start_aa: dom.start,
      end_aa: dom.end,
      sequence: gene.protein.sequence.slice(dom.start, dom.end + 1)
    }));

    return {
      exons: exonsUI,
      domains: domainsUI
    };
  }

  _showMutationResultUI(type, data) {
    const successIcon =
      '<img src="./static/icons/check.svg" width="24" height="24">';

    let html = '';

    switch (type) {
      case 'find':
        html = `
          <p><strong>Результат поиска</strong></p>
          <p>Позиция: <strong>${data.pos}</strong></p>
          <p>Нуклеотид: <strong>${data.nuc}</strong></p>
          <p>Аминокислота: <strong>${data.aa}</strong></p>
          <p>Экзон: <strong>${data.exonName}</strong></p>
          <p>Домен: <strong>${data.domainName}</strong></p>
          <p style="color: #28a745;">${successIcon} Поиск завершен</p>
        `;
        break;

      case 'substitution':
        html = `
          <p><strong>Замена выполнена</strong></p>
          <p>Позиция: <strong>${data.pos}</strong></p>
          <p>Старый нуклеотид: <strong>${data.oldNuc}</strong></p>
          <p>Новый нуклеотид: <strong>${data.newNuc}</strong></p>
          <p>Старая аминокислота: <strong>${data.oldAminoAcid}</strong></p>
          <p>Новая аминокислота: <strong>${data.newAminoAcid}</strong></p>
          <p style="color: #28a745;">${successIcon} Замена применена</p>
        `;
        break;

      case 'insertion':
        html = `
          <p><strong>Вставка выполнена</strong></p>
          <p>Позиция: <strong>после ${data.pos}</strong></p>
          <p>Последовательность: <strong>${data.seq}</strong></p>
          <p>Разница в домене от: <strong>${data.diffPos} аминокислоты</strong></p>
          <p style="color: #28a745;">${successIcon} Вставка применена</p>
        `;
        break;

      case 'deletion':
        html = `
          <p><strong>Удаление выполнено</strong></p>
          <p>Диапазон: <strong>${data.start} - ${data.end}</strong></p>
          <p>Удалено: <strong>${data.delSeq}</strong></p>
          <p>Разница в домене от: <strong>${data.diffPos} аминокислоты</strong></p>
          <p style="color: #28a745;">${successIcon} Удаление применено</p>
        `;
        break;
    }

    showMutationResult(html, false);
  }
}