import { buildRunRecipe, pickSheetSequence } from '@pages/Generator/lib/recipe';
import { describe, expect, it } from 'vitest';

import { ALL_DISTORTION_FLAGS } from './helpers/distortion-flags';
import { buildFamily } from './helpers/paper-family';

const PAGE_COUNT = 20;

const toSequenceIds = (
  sheetCount: number,
  seed: number,
  pageCount: number = PAGE_COUNT
): string[] => {
  const { sheets } = buildFamily(sheetCount);

  return pickSheetSequence(seed, sheets, pageCount).map(({ id }) => {
    return id;
  });
};

const hasAdjacentRepeat = (ids: string[]): boolean => {
  return ids.some((id, index) => {
    return index > 0 && id === ids[index - 1];
  });
};

describe('pickSheetSequence', () => {
  it('раздаёт по экземпляру на страницу', () => {
    expect(toSequenceIds(4, 1)).toHaveLength(PAGE_COUNT);
  });

  it('не ставит один экземпляр на соседние страницы, пока их в семье больше одного', () => {
    for (let sheetCount = 2; sheetCount <= 5; sheetCount += 1) {
      for (let seed = 0; seed < 50; seed += 1) {
        expect(hasAdjacentRepeat(toSequenceIds(sheetCount, seed))).toBe(false);
      }
    }
  });

  it('использует все экземпляры семьи, а не пару из них', () => {
    expect(new Set(toSequenceIds(4, 7)).size).toBe(4);
  });

  it('растёт хвостом: начало последовательности не зависит от числа страниц', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(toSequenceIds(4, seed, 30).slice(0, 3)).toEqual(toSequenceIds(4, seed, 3));
    }
  });

  it('на семье из одного экземпляра отдаёт его на все страницы без ошибки', () => {
    const ids = toSequenceIds(1, 3);

    expect(ids).toHaveLength(PAGE_COUNT);
    expect(new Set(ids)).toEqual(new Set(['sheet-0']));
  });

  it('нулевое число страниц даёт пустую последовательность', () => {
    expect(pickSheetSequence(1, buildFamily(2).sheets, 0)).toEqual([]);
  });
});

describe('листы в рецепте прогона', () => {
  it('соседние страницы не получают один экземпляр', () => {
    const { pages } = buildRunRecipe({
      seed: 11,
      family: buildFamily(3),
      pageCount: PAGE_COUNT,
      flags: ALL_DISTORTION_FLAGS,
      inkColor: null,
    });

    expect(
      hasAdjacentRepeat(
        pages.map(({ sheetId }) => {
          return sheetId;
        })
      )
    ).toBe(false);
  });
});
