import { readFileSync } from 'node:fs';

import { buildPaperFamilies } from '@pages/Generator/config';
import {
  PAPER_PROFILES_VERSION,
  parsePaperProfiles,
} from '@pages/Generator/model/paperProfiles';
import { isJsonRecord } from '@pages/Generator/model/paperSheetJson';
import { describe, expect, it } from 'vitest';

/**
 * Артефакт пресет-пака, посчитанный `npm run build:paper`. Тест читает именно
 * его, а не подделку: смысл проверки — что у настоящих экземпляров разлиновка
 * найдена и записана.
 */
const RAW_ARTIFACT: unknown = JSON.parse(
  readFileSync('public/paper/profiles.json', 'utf8')
);

/**
 * Требование `paper-profile`: в предустановленной семье не меньше четырёх
 * экземпляров.
 */
const MIN_SHEETS_IN_FAMILY = 4;

/**
 * Границы шага разлиновки пресет-пака в пикселях фотографий по семьям,
 * снятые с самих фотографий: клетка — около 53 px, линейка — около 72 px.
 * Запас в пиксель-другой — разброс расстояния съёмки между экземплярами.
 */
const PRESET_STEP_RANGES: Record<string, [number, number]> = {
  grid: [52, 56],
  lined: [70, 75],
};

/**
 * Поля листа, которые разлиновка экземпляра заменила: в артефакте их быть не
 * должно, иначе шаг, фаза и наклон читались бы из двух мест.
 */
const DEPRECATED_SHEET_KEYS = [
  'measuredStep',
  'normalizeScale',
  'skewAngle',
  'firstLinePhase',
];

/**
 * Экземпляры артефакта в сыром виде, до разбора.
 *
 * @returns экземпляры всех семей по порядку
 */
const readRawSheets = (): Record<string, unknown>[] => {
  if (!isJsonRecord(RAW_ARTIFACT) || !isJsonRecord(RAW_ARTIFACT.families)) {
    return [];
  }

  return Object.values(RAW_ARTIFACT.families).reduce<Record<string, unknown>[]>(
    (acc, sheets) => {
      const items: unknown[] = Array.isArray(sheets) ? sheets : [];

      for (const item of items) {
        if (isJsonRecord(item)) {
          acc.push(item);
        }
      }

      return acc;
    },
    []
  );
};

describe('пресет-пак', () => {
  const families = buildPaperFamilies(parsePaperProfiles(RAW_ARTIFACT));

  it('артефакт той версии, которую понимает приложение', () => {
    expect(isJsonRecord(RAW_ARTIFACT) && RAW_ARTIFACT.version).toBe(
      PAPER_PROFILES_VERSION
    );
  });

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

  it('у каждого экземпляра разлиновка посчитана заранее: шаг, поля и линия поля справа', () => {
    for (const family of families) {
      const [stepMin, stepMax] = PRESET_STEP_RANGES[family.id] || [0, 0];

      for (const sheet of family.sheets) {
        const { step, margins, marginLineX, marginLineSide } = sheet.ruling;

        expect(step).toBeGreaterThanOrEqual(stepMin);
        expect(step).toBeLessThanOrEqual(stepMax);
        expect(marginLineSide).toBe('right');
        expect(marginLineX).toBeGreaterThan(sheet.width / 2);
        expect(
          Math.min(margins.top, margins.right, margins.bottom, margins.left)
        ).toBeGreaterThan(0);
      }
    }
  });

  it('в артефакте нет полей, которые заменила разлиновка экземпляра', () => {
    const sheets = readRawSheets();

    expect(sheets.length).toBeGreaterThan(0);

    for (const sheet of sheets) {
      expect(sheet).toHaveProperty('ruling');

      for (const key of DEPRECATED_SHEET_KEYS) {
        expect(sheet).not.toHaveProperty(key);
      }
    }
  });

  it('экземпляры сняты с разного расстояния — шаги различаются', () => {
    for (const family of families) {
      const steps = new Set(
        family.sheets.map((sheet) => {
          return sheet.ruling.step.toFixed(2);
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
