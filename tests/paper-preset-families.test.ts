import { readFileSync } from 'node:fs';

import type { PaperProfilesArtifact } from '@pages/Generator/config';
import { buildPaperFamilies } from '@pages/Generator/config';
import { describe, expect, it } from 'vitest';

/**
 * Артефакт пресет-пака, посчитанный `npm run build:paper`. Тест читает именно
 * его, а не подделку: смысл проверки — что нормировка настоящих экземпляров
 * приводит их к канону семьи.
 */
const ARTIFACT = JSON.parse(
  readFileSync('public/paper/profiles.json', 'utf8')
) as PaperProfilesArtifact;

/**
 * Требование `paper-profile`: в предустановленной семье не меньше четырёх
 * экземпляров.
 */
const MIN_SHEETS_IN_FAMILY = 4;

describe('пресет-пак', () => {
  const families = buildPaperFamilies(ARTIFACT.families);

  it('содержит семьи «в клетку» и «в линейку»', () => {
    expect(
      families
        .map((family) => {
          return family.id;
        })
        .sort()
    ).toEqual(['grid', 'lined']);
  });

  it('в каждой семье не меньше четырёх экземпляров', () => {
    for (const family of families) {
      expect(family.sheets.length).toBeGreaterThanOrEqual(MIN_SHEETS_IN_FAMILY);
    }
  });

  it('у всех экземпляров семьи нормированный шаг совпадает с каноном', () => {
    for (const family of families) {
      for (const sheet of family.sheets) {
        expect(sheet.measuredStep * sheet.normalizeScale).toBeCloseTo(
          family.ruling.step,
          6
        );
      }
    }
  });

  it('экземпляры сняты с разного расстояния — измеренные шаги различаются', () => {
    for (const family of families) {
      const steps = new Set(
        family.sheets.map((sheet) => {
          return sheet.measuredStep.toFixed(2);
        })
      );

      expect(steps.size).toBeGreaterThan(1);
    }
  });

  it('у каждого экземпляра есть пригодное поле освещения и карта текстуры', () => {
    for (const family of families) {
      for (const sheet of family.sheets) {
        expect(sheet.lighting?.isUsable).toBe(true);
        expect(sheet.texture?.src).toMatch(/\.texture\.png$/);
      }
    }
  });
});
