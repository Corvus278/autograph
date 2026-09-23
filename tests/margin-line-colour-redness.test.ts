import type { SheetImageData } from '@pages/Generator/lib/paper';
import { MARGIN_LINE_BAND_STEPS } from '@pages/Generator/lib/paper/detectRuling';
import {
  buildRednessStrips,
  computeMovingMedian,
  isColourVetoEnabled,
  MARGIN_LINE_COLOUR_GATE,
  MARGIN_LINE_MIN_REDNESS,
  measureCandidateRedness,
  measureRedGreenP99,
  type RednessNode,
  sliceRednessStrips,
} from '@pages/Generator/lib/paper/marginLineRedness';
import { computeQuantile } from '@pages/Generator/lib/paper/quantile';
import { buildStripProfiles } from '@pages/Generator/lib/paper/sheetProfile';
import { mulberry32 } from '@shared/lib/random';
import { describe, expect, it } from 'vitest';

import type { SyntheticMarginLineSheet } from './helpers/synthetic-sheet';
import {
  COLOUR_STRAIGHT_MARGIN_LINE_SHEET,
  computeSyntheticColumnX,
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  RED_MARGIN_LINE_COLOUR,
} from './helpers/synthetic-sheet';

/**
 * Избыток `R − G` красной черты над бумагой рядом, в уровнях.
 */
const RED_EXCESS = RED_MARGIN_LINE_COLOUR.marginLineExcess;

/**
 * Номер вертикали клетки, которая нарисована глубже остальных: стоит в правой
 * трети кадра, у стороны без черты.
 */
const DEEP_COLUMN_INDEX = 12;

/**
 * Лист с прямой красной чертой слева и нейтральной вертикалью той же яркостной
 * глубины справа.
 */
const SHEET: SyntheticMarginLineSheet = {
  ...COLOUR_STRAIGHT_MARGIN_LINE_SHEET,
  deepColumn: {
    x:
      COLOUR_STRAIGHT_MARGIN_LINE_SHEET.phase +
      DEEP_COLUMN_INDEX * COLOUR_STRAIGHT_MARGIN_LINE_SHEET.step,
    darkness: COLOUR_STRAIGHT_MARGIN_LINE_SHEET.marginLineDarkness || 0,
  },
};

/**
 * Число полос — как у полосового опроса линии поля: полоса в полшага.
 */
const STRIP_COUNT = Math.round(SHEET.height / (MARGIN_LINE_BAND_STEPS * SHEET.step));

/**
 * Окно фона — шаг, как у яркостного профиля.
 */
const WINDOW = SHEET.step;

/**
 * Узлы трассы вертикали: по одному на полосу, в середине её высоты.
 *
 * @param locate — столбец вертикали на строке кадра
 * @returns узлы по полосам сверху вниз
 */
const toNodes = (locate: (y: number) => number): RednessNode[] => {
  return Array.from({ length: STRIP_COUNT }, (_item, strip) => {
    const y = ((strip + 0.5) * SHEET.height) / STRIP_COUNT;

    return { position: locate(y) };
  });
};

/**
 * Изображение, у которого канал `R − G` задан рядом по модулю: доля `share`
 * пикселей — со значением `level` (со знаком вперемешку), остальные — ноль.
 *
 * @param level — уровень заметных пикселей
 * @param share — их доля
 * @returns изображение
 */
const createChromaImage = (level: number, share: number): SheetImageData => {
  const size = 10_000;
  const redMinusGreen = new Int16Array(size);
  const marked = Math.round(size * share);

  for (let index = 0; index < marked; index += 1) {
    redMinusGreen[index * Math.floor(size / marked)] = index % 2 === 0 ? level : -level;
  }

  return { width: 100, height: 100, luminance: new Float32Array(size), redMinusGreen };
};

describe('мера красноты кандидата в линию поля', () => {
  const image = createSyntheticSheet(SHEET);
  const strips = buildRednessStrips(image, 0, 0, STRIP_COUNT, WINDOW);

  if (!strips) {
    throw new Error('У листа с каналом нет полос красноты');
  }

  it('у красной черты краснота равна её избытку над бумагой', () => {
    const redness = measureCandidateRedness(
      toNodes((y) => {
        return computeSyntheticMarginLineX(SHEET, y) || 0;
      }),
      strips
    );

    expect(Math.abs(redness - RED_EXCESS)).toBeLessThanOrEqual(3);
    expect(redness).toBeGreaterThanOrEqual(MARGIN_LINE_MIN_REDNESS);
  });

  it('у нейтральной вертикали той же яркостной глубины краснота — шум', () => {
    const redness = measureCandidateRedness(
      toNodes((y) => {
        return computeSyntheticColumnX(SHEET, DEEP_COLUMN_INDEX, y);
      }),
      strips
    );

    expect(redness).toBeLessThanOrEqual(2);
  });

  it('полосы, где линия не нашлась, не голосуют; без узлов краснота нулевая', () => {
    const nodes = toNodes((y) => {
      return computeSyntheticMarginLineX(SHEET, y) || 0;
    });
    const sparse = nodes.map((node, index) => {
      return index % 3 === 0 ? node : null;
    });

    expect(
      Math.abs(measureCandidateRedness(sparse, strips) - RED_EXCESS)
    ).toBeLessThanOrEqual(3);
    expect(
      measureCandidateRedness(
        nodes.map(() => {
          return null;
        }),
        strips
      )
    ).toBe(0);
  });

  it('бины и origin полос красноты те же, что у яркостных полос с тем же наклоном', () => {
    const random = mulberry32(5);
    const width = 90;
    const height = 70;
    const redMinusGreen = Int16Array.from({ length: width * height }, () => {
      return Math.round(random() * 510 - 255);
    });
    const angle = 1.3;
    const guardAngle = 2;
    const stripCount = 6;
    const window = 9;
    const colour = buildRednessStrips(
      { width, height, luminance: new Float32Array(width * height), redMinusGreen },
      angle,
      guardAngle,
      stripCount,
      window
    );
    const reference = buildStripProfiles(
      { width, height, luminance: Float32Array.from(redMinusGreen) },
      'vertical',
      angle,
      guardAngle,
      stripCount
    );

    if (!colour) {
      throw new Error('У изображения с каналом нет полос красноты');
    }

    /**
     * Бины опрашиваются с конца и вразброс: число бина не должно зависеть от
     * того, какие бины посчитаны до него.
     */
    const excess = Array.from({ length: colour.count }, (_item, strip) => {
      const values = new Array<number>(colour.size).fill(Number.NaN);

      for (let bin = values.length - 1; bin >= 0; bin -= 3) {
        values[bin] = colour.excessAt(strip, bin);
      }

      for (const [bin] of values.entries()) {
        values[bin] = colour.excessAt(strip, bin);
      }

      return values;
    });

    expect(colour.origin).toBe(reference[0]?.origin);
    expect(colour.size).toBe(reference[0]?.values.length);
    expect(excess).toStrictEqual(
      reference.map(({ values }) => {
        const background = computeMovingMedian(values, window);

        return Array.from(values, (value, bin) => {
          return value - (background[bin] || 0);
        });
      })
    );
  });

  it('канал читается только у узлов кандидата, и краснота та же', () => {
    const sheet = createSyntheticSheet(SHEET);
    const { width, redMinusGreen } = sheet;

    if (!redMinusGreen) {
      throw new Error('У листа нет канала');
    }

    const readColumns: number[] = [];
    const watched = new Proxy(redMinusGreen, {
      get: (target, key, receiver) => {
        if (typeof key === 'string' && /^\d+$/.test(key)) {
          readColumns.push(Number(key) % width);
        }

        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const lazy = buildRednessStrips(
      { ...sheet, redMinusGreen: watched },
      0,
      0,
      STRIP_COUNT,
      WINDOW
    );

    expect(readColumns).toHaveLength(0);

    if (!lazy) {
      throw new Error('У листа с каналом нет полос красноты');
    }

    const nodes = toNodes((y) => {
      return computeSyntheticMarginLineX(SHEET, y) || 0;
    });
    const positions = nodes.map(({ position }) => {
      return position;
    });
    const reach = WINDOW / 2 + 3;
    const nearest = Math.min(...positions) - reach;
    const farthest = Math.max(...positions) + reach;

    expect(measureCandidateRedness(nodes, lazy)).toBe(
      measureCandidateRedness(nodes, strips)
    );
    expect(readColumns.length).toBeGreaterThan(0);
    expect(readColumns.length).toBeLessThan(sheet.width * sheet.height * 0.2);
    expect(
      readColumns.every((x) => {
        return x >= nearest && x <= farthest;
      })
    ).toBe(true);
  });

  it('срез полос сдвигает номера к первой выбранной', () => {
    const sliced = sliceRednessStrips(strips, 2, 5);

    expect(sliced.count).toBe(3);
    expect(sliced.origin).toBe(strips.origin);
    expect(sliced.excessAt(1, 40)).toBe(strips.excessAt(3, 40));
    expect(sliceRednessStrips(strips, strips.count - 1, strips.count + 4).count).toBe(1);
  });

  it('без канала полос красноты нет', () => {
    expect(
      buildRednessStrips(
        createSyntheticSheet({ ...SHEET, colour: null }),
        0,
        0,
        STRIP_COUNT,
        WINDOW
      )
    ).toBeNull();
  });
});

describe('гейт серого снимка', () => {
  it('99-й процентиль |R − G| — член ряда, как у computeQuantile', () => {
    const random = mulberry32(3);
    const redMinusGreen = Int16Array.from({ length: 5000 }, () => {
      return Math.round((random() * 2 - 1) * 40 * random());
    });
    const expected = computeQuantile(Array.from(redMinusGreen, Math.abs), 0.99);

    expect(
      measureRedGreenP99({
        width: 50,
        height: 100,
        luminance: new Float32Array(5000),
        redMinusGreen,
      })
    ).toBe(expected);
  });

  it('на ряде без повторов процентиль — ровно член с номером ⌊0,99·n⌋', () => {
    const redMinusGreen = Int16Array.from({ length: 100 }, (_item, index) => {
      return index % 2 === 0 ? index : -index;
    });

    expect(
      measureRedGreenP99({
        width: 10,
        height: 10,
        luminance: new Float32Array(100),
        redMinusGreen,
      })
    ).toBe(99);
  });

  it('выключен при P99 4 и без канала, включён при P99 6', () => {
    const gray = createChromaImage(4, 0.02);
    const colour = createChromaImage(6, 0.02);

    expect(measureRedGreenP99(gray)).toBe(4);
    expect(measureRedGreenP99(colour)).toBe(6);
    expect(isColourVetoEnabled(measureRedGreenP99(gray))).toBe(false);
    expect(isColourVetoEnabled(measureRedGreenP99(colour))).toBe(true);
    expect(
      measureRedGreenP99(createSyntheticSheet({ ...SHEET, colour: null }))
    ).toBeNull();
    expect(isColourVetoEnabled(null)).toBe(false);
    expect(MARGIN_LINE_COLOUR_GATE).toBe(5);
  });
});
