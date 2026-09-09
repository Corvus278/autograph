import type { Line } from '../split/splitParagraphs.types';

import type { Page, PaginateOptions } from './paginate.types';

/**
 * Раскладывает строки по страницам по доступной высоте. Строка, которая не
 * помещается даже на пустую страницу, всё равно занимает свою: иначе разбивка
 * зациклится на нулевой высоте.
 *
 * Пустой текст даёт одну пустую страницу — генератор всегда показывает лист.
 */
export const paginate = (lines: Line[], options: PaginateOptions): Page[] => {
  const { availableHeight, measure } = options;

  if (lines.length === 0) {
    return [{ lines: [] }];
  }

  const lineHeight = measure.measureLineHeight();
  const pages: Page[] = [];
  let current: Line[] = [];
  let used = 0;

  for (const line of lines) {
    if (current.length > 0 && used + lineHeight > availableHeight) {
      pages.push({ lines: current });
      current = [];
      used = 0;
    }

    current.push(line);
    used += lineHeight;
  }

  pages.push({ lines: current });

  return pages;
};
