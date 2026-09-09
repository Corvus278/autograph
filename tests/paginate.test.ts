import { paginate } from '@pages/Generator/lib/paginate/paginate';
import type { Line } from '@pages/Generator/lib/split/splitParagraphs.types';
import { describe, expect, it } from 'vitest';

import { createMonospaceMeasurer } from './helpers/monospace-measurer';

/**
 * Высота строки — 20 пикселей, поэтому высота 100 держит ровно пять строк.
 */
const measure = createMonospaceMeasurer({ lineHeight: 20 });

/**
 * Собирает нужное число строк одного абзаца: содержимое для разбивки не важно,
 * важно только их количество.
 */
const buildLines = (count: number): Line[] => {
  return Array.from({ length: count }, (_item, index) => {
    return { text: `строка ${index + 1}`, paragraphIndex: 0 };
  });
};

describe('paginate', () => {
  it('кладёт весь текст на одну страницу, если он помещается', () => {
    const pages = paginate(buildLines(5), { availableHeight: 100, measure });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.lines).toHaveLength(5);
  });

  it('разбивает ровно на две страницы', () => {
    const pages = paginate(buildLines(10), { availableHeight: 100, measure });

    expect(pages).toHaveLength(2);
    expect(pages[0]?.lines).toHaveLength(5);
    expect(pages[1]?.lines).toHaveLength(5);
  });

  it('переносит строку на границе страницы целиком', () => {
    const pages = paginate(buildLines(6), { availableHeight: 100, measure });

    expect(pages).toHaveLength(2);
    expect(pages[0]?.lines).toHaveLength(5);
    expect(
      pages[1]?.lines.map(({ text }) => {
        return text;
      })
    ).toEqual(['строка 6']);
  });

  it('на нулевой доступной высоте даёт по странице на строку', () => {
    const pages = paginate(buildLines(3), { availableHeight: 0, measure });

    expect(pages).toHaveLength(3);
  });

  it('на пустом тексте возвращает одну пустую страницу', () => {
    const pages = paginate([], { availableHeight: 100, measure });

    expect(pages).toEqual([{ lines: [] }]);
  });
});
