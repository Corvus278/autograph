import type { PaperFamily, PaperSheet } from '@pages/Generator/lib/paper';
import {
  buildNormalizedSheet,
  computeNormalizeScale,
  toCanonicalLength,
  toPhotoLength,
} from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

const FAMILY: Pick<PaperFamily, 'ruling'> = {
  ruling: {
    kind: 'lined',
    step: 40,
    firstLineOffset: 80,
    margins: { top: 80, right: 40, bottom: 60, left: 60 },
    marginLineX: 60,
  },
};

const SHEET_BASE: Omit<PaperSheet, 'measuredStep' | 'normalizeScale' | 'firstLinePhase'> =
  {
    id: 'sheet-1',
    label: 'Лист 1',
    src: '/sheet-1.jpg',
    width: 1600,
    height: 2000,
    skewAngle: 0.7,
    lighting: null,
    texture: null,
  };

describe('computeNormalizeScale', () => {
  it('приводит измеренный шаг к каноническому', () => {
    const scale = computeNormalizeScale(50, 40);

    expect(50 * scale).toBeCloseTo(40, 10);
  });

  it('на нулевом измеренном шаге не ломается и оставляет масштаб единичным', () => {
    expect(computeNormalizeScale(0, 40)).toBe(1);
  });

  it('на отрицательном измеренном шаге оставляет масштаб единичным', () => {
    expect(computeNormalizeScale(-10, 40)).toBe(1);
  });

  it('на нулевом каноническом шаге оставляет масштаб единичным', () => {
    expect(computeNormalizeScale(50, 0)).toBe(1);
  });

  it('на совпадающих шагах даёт единицу', () => {
    expect(computeNormalizeScale(40, 40)).toBe(1);
  });
});

describe('buildNormalizedSheet', () => {
  it('нормирует шаг экземпляра к канону семьи', () => {
    const sheet = buildNormalizedSheet(
      { step: 64, firstLinePhase: 120 },
      FAMILY,
      SHEET_BASE
    );

    expect(64 * sheet.normalizeScale).toBeCloseTo(FAMILY.ruling.step, 10);
    expect(sheet.firstLinePhase).toBe(120);
  });

  it('у экземпляров с разным измеренным шагом канонический шаг совпадает', () => {
    const first = buildNormalizedSheet(
      { step: 48, firstLinePhase: 90 },
      FAMILY,
      SHEET_BASE
    );
    const second = buildNormalizedSheet({ step: 72, firstLinePhase: 130 }, FAMILY, {
      ...SHEET_BASE,
      id: 'sheet-2',
    });

    expect(48 * first.normalizeScale).toBeCloseTo(72 * second.normalizeScale, 10);
  });

  it('не трогает остальные характеристики экземпляра', () => {
    const sheet = buildNormalizedSheet(
      { step: 40, firstLinePhase: 0 },
      FAMILY,
      SHEET_BASE
    );

    expect(sheet.skewAngle).toBe(SHEET_BASE.skewAngle);
    expect(sheet.src).toBe(SHEET_BASE.src);
  });
});

describe('перевод длин', () => {
  it('туда и обратно даёт исходную длину', () => {
    const sheet = buildNormalizedSheet(
      { step: 55, firstLinePhase: 10 },
      FAMILY,
      SHEET_BASE
    );

    expect(toPhotoLength(sheet, toCanonicalLength(sheet, 123))).toBeCloseTo(123, 10);
    expect(toPhotoLength(sheet, FAMILY.ruling.step)).toBeCloseTo(55, 10);
  });

  it('переводит пиксели фотографии в канонические по шагу', () => {
    const sheet = buildNormalizedSheet(
      { step: 80, firstLinePhase: 10 },
      FAMILY,
      SHEET_BASE
    );

    expect(toCanonicalLength(sheet, 80)).toBeCloseTo(FAMILY.ruling.step, 10);
  });
});
