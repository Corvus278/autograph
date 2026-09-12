import type { RunRecipe } from '@pages/Generator/lib/recipe';
import {
  buildRunRecipe,
  CONTOUR_AMPLITUDE,
  CONTOUR_CELL_SIZE,
  JPEG_QUALITY,
} from '@pages/Generator/lib/recipe';
import { describe, expect, it } from 'vitest';

import { ALL_DISTORTION_FLAGS } from './helpers/distortion-flags';
import { buildFamily } from './helpers/paper-family';

const FAMILY = buildFamily(4);
const PAGE_COUNT = 6;

/**
 * Сочетание, которое рецепт выдаёт на seed 2024 в семье из четырёх
 * экземпляров. Значения сняты с рабочего кода: смысл теста — заметить, что
 * они изменились.
 */
const GOLDEN_SHEET_IDS = ['sheet-2', 'sheet-1', 'sheet-0', 'sheet-2'];
const GOLDEN_INK_COLOR = '#4f3187';
const GOLDEN_HANDWRITING_SEED = 1_114_416_868;

const buildRecipe = (
  seed: number,
  pageCount: number = PAGE_COUNT,
  inkColor: string | null = null
): RunRecipe => {
  return buildRunRecipe({
    seed,
    family: FAMILY,
    pageCount,
    flags: ALL_DISTORTION_FLAGS,
    inkColor,
  });
};

const toSheetIds = (recipe: RunRecipe): string[] => {
  return recipe.pages.map(({ sheetId }) => {
    return sheetId;
  });
};

describe('buildRunRecipe', () => {
  it('даёт экземпляр листа и seed контуров на каждую страницу', () => {
    const { pages } = buildRecipe(7);
    const familySheetIds = FAMILY.sheets.map(({ id }) => {
      return id;
    });

    expect(pages).toHaveLength(PAGE_COUNT);

    pages.forEach((page, index) => {
      expect(page.pageIndex).toBe(index);
      expect(familySheetIds).toContain(page.sheetId);
      expect(Number.isInteger(page.contourSeed)).toBe(true);
    });
  });

  it('не подменяет семью листов', () => {
    expect(buildRecipe(7).familyId).toBe(FAMILY.id);
  });

  it('несёт цвет чернил, параметры почерка, вариативности и оптики', () => {
    const { inkColor, handwriting, contour, optics } = buildRecipe(7);

    expect(inkColor).toMatch(/^#[\da-f]{6}$/);
    expect(handwriting.flags).toEqual(ALL_DISTORTION_FLAGS);
    expect(Number.isInteger(handwriting.seed)).toBe(true);
    expect(contour).toEqual({
      amplitude: CONTOUR_AMPLITUDE,
      cellSize: CONTOUR_CELL_SIZE,
    });
    /**
     * Множителя разрешения в оптике нет: снимок равен кадру листа страницы, и
     * от прогона зависит только качество кодирования.
     */
    expect(optics).toStrictEqual({ jpegQuality: JPEG_QUALITY });
  });

  it('держит частоты побуквенной обработки в границах 1..3 и обе границы достижимы', () => {
    const frequencies = new Set<number>();

    for (let seed = 0; seed < 100; seed += 1) {
      const { wordFrequency, letterFrequency } = buildRecipe(seed).handwriting;

      frequencies.add(wordFrequency);
      frequencies.add(letterFrequency);
      expect(wordFrequency).toBeGreaterThanOrEqual(1);
      expect(wordFrequency).toBeLessThanOrEqual(3);
      expect(letterFrequency).toBeGreaterThanOrEqual(1);
      expect(letterFrequency).toBeLessThanOrEqual(3);
    }

    expect(frequencies).toEqual(new Set([1, 2, 3]));
  });

  it('на одном seed собирается одинаковым целиком', () => {
    expect(buildRecipe(2024)).toEqual(buildRecipe(2024));
  });

  it('не меняется от числа страниц: дописанная страница только удлиняет хвост', () => {
    const short = buildRecipe(2024, 3);
    const long = buildRecipe(2024, 30);

    expect(long.inkColor).toBe(short.inkColor);
    expect(long.handwriting).toEqual(short.handwriting);
    expect(long.pages.slice(0, 3)).toEqual(short.pages);
  });

  it('на другом seed меняет цвет чернил и параметры почерка', () => {
    const first = buildRecipe(1);
    const second = buildRecipe(2);

    expect(second.inkColor).not.toBe(first.inkColor);
    expect(second.handwriting.seed).not.toBe(first.handwriting.seed);
    expect(toSheetIds(second)).not.toEqual(toSheetIds(first));
  });

  it('на нулевом числе страниц отдаёт рецепт без страниц', () => {
    const recipe = buildRecipe(5, 0);

    expect(recipe.pages).toEqual([]);
    expect(recipe.inkColor).toMatch(/^#[\da-f]{6}$/);
    expect(recipe.handwriting).toEqual(buildRecipe(5, 6).handwriting);
  });

  it('на одной странице отдаёт ровно одну', () => {
    const { pages } = buildRecipe(5, 1);

    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageIndex).toBe(0);
  });

  it('на семье из одного экземпляра кладёт его на все страницы', () => {
    const { pages } = buildRunRecipe({
      seed: 3,
      family: buildFamily(1),
      pageCount: 5,
      flags: ALL_DISTORTION_FLAGS,
      inkColor: null,
    });

    expect(pages).toHaveLength(5);
    expect(
      new Set(
        pages.map(({ sheetId }) => {
          return sheetId;
        })
      )
    ).toEqual(new Set(['sheet-0']));
  });

  it('пропускает в рецепт заданные пользователем частоты', () => {
    const { handwriting } = buildRunRecipe({
      seed: 2024,
      family: FAMILY,
      pageCount: 4,
      flags: ALL_DISTORTION_FLAGS,
      inkColor: null,
      wordFrequency: 5,
      letterFrequency: 4,
    });

    expect(handwriting.wordFrequency).toBe(5);
    expect(handwriting.letterFrequency).toBe(4);
  });

  it('фиксация частоты не сдвигает ни цвет, ни листы, ни seed почерка', () => {
    const seeded = buildRecipe(2024, 4);
    const fixed = buildRunRecipe({
      seed: 2024,
      family: FAMILY,
      pageCount: 4,
      flags: ALL_DISTORTION_FLAGS,
      inkColor: null,
      wordFrequency: 5,
      letterFrequency: 4,
    });

    expect(fixed.inkColor).toBe(seeded.inkColor);
    expect(fixed.pages).toEqual(seeded.pages);
    expect(fixed.handwriting.seed).toBe(seeded.handwriting.seed);
  });

  it('на `null` берёт частоты из seed', () => {
    const fromSeed = buildRecipe(2024, 4).handwriting;
    const withNulls = buildRunRecipe({
      seed: 2024,
      family: FAMILY,
      pageCount: 4,
      flags: ALL_DISTORTION_FLAGS,
      inkColor: null,
      wordFrequency: null,
      letterFrequency: null,
    }).handwriting;

    expect(withNulls).toEqual(fromSeed);
    expect(fromSeed.wordFrequency).toBeGreaterThanOrEqual(1);
    expect(fromSeed.letterFrequency).toBeGreaterThanOrEqual(1);
  });

  /**
   * Золотой снимок: порядок черпаний — часть контракта. Смена порядка меняет
   * картинку на том же seed и молча обесценивает скриншотные эталоны, поэтому
   * такая смена обязана ронять тест, а не проходить незамеченной.
   */
  it('на фиксированном seed выдаёт зафиксированное сочетание', () => {
    const recipe = buildRecipe(2024, 4);

    expect(toSheetIds(recipe)).toEqual(GOLDEN_SHEET_IDS);
    expect(recipe.inkColor).toBe(GOLDEN_INK_COLOR);
    expect(recipe.handwriting.seed).toBe(GOLDEN_HANDWRITING_SEED);
  });
});
