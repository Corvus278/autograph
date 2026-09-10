import { BASE_FONT_SIZE_PX, deriveGeometry } from '@pages/Generator/lib/calibrate';
import type { FontMetrics } from '@pages/Generator/lib/measure/measure.types';
import type { Page } from '@pages/Generator/lib/paginate/paginate.types';
import type { PaperFamily, PaperSheet } from '@pages/Generator/lib/paper';
import { buildNormalizedSheet, toCanonicalLength } from '@pages/Generator/lib/paper';
import { clearLayoutCache, measureLayout } from '@pages/Generator/model/measureLayout';
import type { MeasurerFactory } from '@pages/Generator/model/measureLayout.types';
import { beforeEach, describe, expect, it } from 'vitest';

import { createMonospaceMeasurer } from './helpers/monospace-measurer';

const METRICS: FontMetrics = { xHeight: 0.48, fontAscent: 0.95, lineHeight: 1.25 };

/**
 * Ширина символа измерителя-модели. От экземпляра листа не зависит: шрифт
 * задаётся семьёй, а не фотографией.
 */
const CHAR_WIDTH = 12;

const FONT_FAMILY = 'Abram';

const RULING: PaperFamily['ruling'] = {
  kind: 'lined',
  step: 40,
  firstLineOffset: 80,
  margins: { top: 80, right: 40, bottom: 60, left: 60 },
  marginLineX: 60,
};

const SHEET_BASE: Omit<
  PaperSheet,
  | 'measuredStep'
  | 'normalizeScale'
  | 'firstLinePhase'
  | 'id'
  | 'src'
  | 'width'
  | 'height'
  | 'skewAngle'
> = {
  label: 'Лист',
  lighting: null,
  texture: null,
};

/**
 * Два экземпляра одной семьи, снятые с разного расстояния и под разным углом:
 * измеренный шаг, размер кадра, наклон и файл у них разные, а канонический
 * размер листа после нормировки совпадает.
 */
const FIRST_SHEET = buildNormalizedSheet(
  { step: 50, firstLinePhase: 100 },
  { ruling: RULING },
  {
    ...SHEET_BASE,
    id: 'sheet-near',
    src: '/sheet-near.jpg',
    width: 1600,
    height: 2000,
    skewAngle: 0.7,
  }
);

const SECOND_SHEET = buildNormalizedSheet(
  { step: 62.5, firstLinePhase: 175 },
  { ruling: RULING },
  {
    ...SHEET_BASE,
    id: 'sheet-far',
    src: '/sheet-far.jpg',
    width: 2000,
    height: 2500,
    skewAngle: -1.4,
  }
);

const FAMILY: PaperFamily = {
  id: 'lined',
  label: 'Линейка',
  width: 1280,
  height: 1600,
  ruling: RULING,
  sheets: [FIRST_SHEET, SECOND_SHEET],
};

/**
 * Текст в несколько страниц: на одной странице разница в разбивке не видна.
 */
const TEXT = Array.from({ length: 40 }, (_, index) => {
  return `Абзац ${index}: ${'слово '.repeat(40).trim()}`;
}).join('\n');

/**
 * Измеритель-модель для продакшн-входа разбивки: высоту строки считает по тем
 * же параметрам, которые уходят в стиль страницы, — кегль в em и межстрочная
 * добавка в пикселях.
 */
const createMeasurer: MeasurerFactory = ({ fontSize, lineSpacing }) => {
  const fontSizePx = fontSize * BASE_FONT_SIZE_PX;

  return {
    ...createMonospaceMeasurer({
      charWidth: CHAR_WIDTH,
      lineHeight: fontSizePx * METRICS.lineHeight + lineSpacing,
    }),
    destroy: () => {},
  };
};

const GEOMETRY = deriveGeometry({ ...FAMILY.ruling, pageWidth: FAMILY.width }, METRICS);

/**
 * Параметры отрисовки, которые уходят в измеритель. Кегль переводится в em
 * здесь — на границе с DOM, геометрия живёт в пикселях.
 */
const MEASURER_PARAMS = {
  fontFamily: FONT_FAMILY,
  fontSize: GEOMETRY.fontSizePx / BASE_FONT_SIZE_PX,
  lineSpacing: GEOMETRY.lineSpacing,
};

/**
 * Раскладка страницы продакшн-входом `measureLayout`: геометрия выводится из
 * разлиновки семьи, а высота листа берётся из экземпляра, приведённого к
 * канону. Экземпляр входит только нормированным — в этом и проверка.
 *
 * @param sheet — экземпляр листа, на котором рисуется страница
 * @returns страницы со строками
 */
const buildLayout = (sheet: PaperSheet): Page[] => {
  const pageHeight = toCanonicalLength(sheet, sheet.height);
  const availableHeight = pageHeight - GEOMETRY.topOffset - FAMILY.ruling.margins.bottom;

  return measureLayout(
    {
      text: TEXT,
      blockWidth: GEOMETRY.blockWidth,
      availableHeight,
      measurerParams: MEASURER_PARAMS,
    },
    createMeasurer
  );
};

/**
 * Та же раскладка, но высота листа берётся в пикселях фотографии, без
 * приведения к канону. Так выглядела бы зависимость раскладки от экземпляра —
 * держим её рядом, чтобы совпадение страниц выше не оказалось совпадением
 * пустых результатов.
 *
 * @param sheet — экземпляр листа
 * @returns страницы со строками
 */
const buildPhotoLayout = (sheet: PaperSheet): Page[] => {
  const availableHeight =
    sheet.height - GEOMETRY.topOffset - FAMILY.ruling.margins.bottom;

  return measureLayout(
    {
      text: TEXT,
      blockWidth: GEOMETRY.blockWidth,
      availableHeight,
      measurerParams: MEASURER_PARAMS,
    },
    createMeasurer
  );
};

describe('пагинация не зависит от экземпляра листа', () => {
  beforeEach(() => {
    /**
     * Кэш разбивки живёт между тестами: без сброса второй экземпляр получил бы
     * готовый результат первого, и проверка стала бы пустой.
     */
    clearLayoutCache();
  });

  it('экземпляры различаются кадром, наклоном и нормировкой', () => {
    expect(FIRST_SHEET.normalizeScale).not.toBeCloseTo(SECOND_SHEET.normalizeScale, 6);
    expect(FIRST_SHEET.skewAngle).not.toBe(SECOND_SHEET.skewAngle);
    expect(FIRST_SHEET.src).not.toBe(SECOND_SHEET.src);
  });

  it('после нормировки канонический размер листа у экземпляров совпадает', () => {
    expect(toCanonicalLength(FIRST_SHEET, FIRST_SHEET.height)).toBeCloseTo(
      toCanonicalLength(SECOND_SHEET, SECOND_SHEET.height),
      6
    );
  });

  it('разбивка на строки и страницы совпадает полностью', () => {
    const first = buildLayout(FIRST_SHEET);

    clearLayoutCache();

    const second = buildLayout(SECOND_SHEET);

    expect(first.length).toBeGreaterThan(1);
    expect(second).toEqual(first);
  });

  it('состав строк на каждой странице совпадает', () => {
    const toTexts = (pages: Page[]): string[][] => {
      return pages.map((page) => {
        return page.lines.map((line) => {
          return line.text;
        });
      });
    };

    const first = buildLayout(FIRST_SHEET);

    clearLayoutCache();

    const second = buildLayout(SECOND_SHEET);

    expect(toTexts(second)).toEqual(toTexts(first));
  });

  it('пачка на разных экземплярах совпадает с пачкой на одном', () => {
    const single = buildLayout(FIRST_SHEET);

    const mixed = [FIRST_SHEET, SECOND_SHEET, FIRST_SHEET].map((sheet) => {
      clearLayoutCache();

      return buildLayout(sheet);
    });

    for (const pages of mixed) {
      expect(pages).toEqual(single);
    }
  });

  it('без нормировки экземпляра разбивка разъехалась бы', () => {
    const first = buildPhotoLayout(FIRST_SHEET);

    clearLayoutCache();

    const second = buildPhotoLayout(SECOND_SHEET);

    expect(second).not.toEqual(first);
  });
});
