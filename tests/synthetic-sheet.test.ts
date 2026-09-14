import type { SheetImageData } from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticColumnX,
  computeSyntheticLineEnds,
  computeSyntheticLineY,
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const WIDTH = 600;

const HEIGHT = 480;

const STEP = 30;

/**
 * Треть шага — изгиб, который измерение обязано держать у углов кадра.
 */
const BEND_AMPLITUDE = 0.3 * STEP;

/**
 * Глубина линии разлиновки по умолчанию у хелпера.
 */
const LINE_DARKNESS = 0.45;

/**
 * Полуокно центроида: меньше половины шага, чтобы соседняя линия в окно не
 * попала даже при изгибе.
 */
const CENTER_WINDOW = 12;

/**
 * Центр гауссианы по растру восстанавливается с точностью до тысячных; сотые
 * уже поймали бы изгиб, применённый не в той точке.
 */
const CENTER_TOLERANCE = 0.05;

/**
 * Конец линии обрезан по пикселю: первый тёмный пиксель лежит не дальше
 * пикселя от границы.
 */
const END_TOLERANCE = 1;

/**
 * Изгиб заметно больше допуска: иначе тест не отличил бы изогнутую линию от
 * прямой.
 */
const MIN_VISIBLE_BEND = 3;

/**
 * Доля высоты кадра от −1 у верха до 1 у низа.
 *
 * @param y — высота в кадре
 * @returns доля от −1 до 1
 */
const toHeightShare = (y: number): number => {
  return (2 * y) / HEIGHT - 1;
};

/**
 * Насколько пиксель темнее бумаги. Бумага в тестах без шума и света, поэтому
 * тёмное — это только нарисованное.
 *
 * @param image — кадр
 * @param x — столбец
 * @param y — строка
 * @returns глубина от 0 до 1
 */
const readInk = (image: SheetImageData, x: number, y: number): number => {
  return 1 - (image.luminance[y * image.width + x] || 0);
};

/**
 * Центр линии по растру: центроид тёмного в столбце. Меряется по растру, а не
 * возвратом функции смещения: иначе тест сверял бы эталон сам с собой и не
 * заметил бы, что отрисовка изгиб не применила.
 *
 * @param image — кадр
 * @param x — столбец
 * @param expectedY — ожидаемый центр, вокруг которого берётся окно
 * @returns высота центра линии
 */
const measureColumnCenter = (
  image: SheetImageData,
  x: number,
  expectedY: number
): number => {
  let weight = 0;
  let moment = 0;

  for (
    let y = Math.round(expectedY - CENTER_WINDOW);
    y <= Math.round(expectedY + CENTER_WINDOW);
    y += 1
  ) {
    const ink = readInk(image, x, y);

    weight += ink;
    moment += ink * y;
  }

  return moment / weight;
};

/**
 * Центр вертикальной линии по растру: центроид тёмного в строке.
 *
 * @param image — кадр
 * @param y — строка
 * @param expectedX — ожидаемый центр, вокруг которого берётся окно
 * @returns столбец центра линии
 */
const measureRowCenter = (
  image: SheetImageData,
  y: number,
  expectedX: number
): number => {
  let weight = 0;
  let moment = 0;

  for (
    let x = Math.round(expectedX - CENTER_WINDOW);
    x <= Math.round(expectedX + CENTER_WINDOW);
    x += 1
  ) {
    const ink = readInk(image, x, y);

    weight += ink;
    moment += ink * x;
  }

  return moment / weight;
};

/**
 * Крайние тёмные столбцы строки. `-1` — тёмного в строке нет.
 */
type InkSpan = {
  /**
   * Первый тёмный столбец.
   */
  first: number;

  /**
   * Последний тёмный столбец.
   */
  last: number;
};

/**
 * Первый и последний столбец строки, где чернил больше половины глубины линии.
 *
 * @param image — кадр
 * @param y — строка
 * @returns крайние тёмные столбцы
 */
const findInkSpan = (image: SheetImageData, y: number): InkSpan => {
  let first = -1;
  let last = -1;

  for (let x = 0; x < image.width; x += 1) {
    if (readInk(image, x, y) > LINE_DARKNESS / 2) {
      first = first < 0 ? x : first;
      last = x;
    }
  }

  return { first, last };
};

describe('createSyntheticSheet: изгиб горизонтальных линий', () => {
  /**
   * Перспектива: концы линий у верха и низа кадра уходят в разные стороны,
   * у середины ширины линия прямая.
   */
  const BENT_SHEET: SyntheticSheetParams = {
    width: WIDTH,
    height: HEIGHT,
    step: STEP,
    phase: 15,
    angle: 1,
    margins: { top: 30, right: 0, bottom: 30, left: 0 },
    bend: (x, y) => {
      return BEND_AMPLITUDE * ((2 * x) / WIDTH - 1) ** 2 * toHeightShare(y);
    },
  };

  it.each([1, 7, 14])(
    'центр линии %i в столбцах лежит на эталонном смещении',
    (index) => {
      const image = createSyntheticSheet(BENT_SHEET);

      [40, 300, 560].forEach((x) => {
        const expectedY = computeSyntheticLineY(BENT_SHEET, index, x);

        expect(
          Math.abs(measureColumnCenter(image, x, expectedY) - expectedY)
        ).toBeLessThan(CENTER_TOLERANCE);
      });
    }
  );

  it('эталон изогнутой линии отходит от прямой', () => {
    const bentY = computeSyntheticLineY(BENT_SHEET, 1, 40);
    const straightY = computeSyntheticLineY(
      {
        ...BENT_SHEET,
        bend: () => {
          return 0;
        },
      },
      1,
      40
    );

    expect(Math.abs(bentY - straightY)).toBeGreaterThan(MIN_VISIBLE_BEND);
  });
});

describe('createSyntheticSheet: изогнутые концы горизонтальных линий', () => {
  const ENDS_SHEET: SyntheticSheetParams = {
    width: WIDTH,
    height: HEIGHT,
    step: STEP,
    phase: 15,
    angle: 1,
    margins: { top: 30, right: 40, bottom: 30, left: 50 },
    lineEndsBend: {
      left: (y) => {
        return 40 * toHeightShare(y) ** 2;
      },
      right: (y) => {
        return -30 * (1 - toHeightShare(y) ** 2);
      },
    },
  };

  it.each([1, 7, 14])('концы линии %i лежат на эталонных границах', (index) => {
    const image = createSyntheticSheet(ENDS_SHEET);
    const leftRow = Math.round(computeSyntheticLineY(ENDS_SHEET, index, 60));
    const rightRow = Math.round(computeSyntheticLineY(ENDS_SHEET, index, WIDTH - 60));

    expect(
      Math.abs(
        findInkSpan(image, leftRow).first -
          computeSyntheticLineEnds(ENDS_SHEET, leftRow).left
      )
    ).toBeLessThanOrEqual(END_TOLERANCE);
    expect(
      Math.abs(
        findInkSpan(image, rightRow).last -
          computeSyntheticLineEnds(ENDS_SHEET, rightRow).right
      )
    ).toBeLessThanOrEqual(END_TOLERANCE);
  });

  it('эталонная граница концов отходит от прямой', () => {
    const { left } = computeSyntheticLineEnds(ENDS_SHEET, 45);
    const { left: straightLeft } = computeSyntheticLineEnds(
      { ...ENDS_SHEET, lineEndsBend: {} },
      45
    );

    expect(Math.abs(left - straightLeft)).toBeGreaterThan(MIN_VISIBLE_BEND);
  });
});

describe('createSyntheticSheet: изогнутые вертикали', () => {
  it('центр изогнутой линии поля в строках лежит на эталоне', () => {
    const params: SyntheticSheetParams = {
      width: WIDTH,
      height: HEIGHT,
      angle: 1,
      kind: 'blank',
      marginLineX: 90,
      marginLineBend: (y) => {
        return BEND_AMPLITUDE * toHeightShare(y) ** 2;
      },
    };
    const image = createSyntheticSheet(params);

    [40, 240, 440].forEach((y) => {
      const expectedX = computeSyntheticMarginLineX(params, y) || 0;

      expect(Math.abs(measureRowCenter(image, y, expectedX) - expectedX)).toBeLessThan(
        CENTER_TOLERANCE
      );
    });
    expect(
      Math.abs(
        (computeSyntheticMarginLineX(params, 40) || 0) -
          (90 - 40 * Math.tan(Math.PI / 180))
      )
    ).toBeGreaterThan(MIN_VISIBLE_BEND);
  });

  it('центр изогнутой крайней вертикали клетки в строках лежит на эталоне', () => {
    const params: SyntheticSheetParams = {
      width: WIDTH,
      height: HEIGHT,
      step: STEP,
      phase: 15,
      angle: 0.5,
      kind: 'grid',
      margins: { top: 30, right: 30, bottom: 30, left: 30 },
      columnBend: (x, y) => {
        return x < 60 ? BEND_AMPLITUDE * toHeightShare(y) ** 2 : 0;
      },
    };
    const image = createSyntheticSheet(params);

    [60, 180, 420].forEach((y) => {
      [1, 5, 18].forEach((index) => {
        const expectedX = computeSyntheticColumnX(params, index, y);

        expect(Math.abs(measureRowCenter(image, y, expectedX) - expectedX)).toBeLessThan(
          CENTER_TOLERANCE
        );
      });
    });
    expect(
      computeSyntheticColumnX(params, 1, 60) - (45 - 60 * Math.tan(Math.PI / 360))
    ).toBeGreaterThan(MIN_VISIBLE_BEND);
  });
});

describe('createSyntheticSheet: помехи у края листа', () => {
  it('рисует пятна спирали с заданным шагом', () => {
    const image = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      kind: 'blank',
      spiral: { x: 30, period: 37, phase: 10, radius: 6, darkness: 0.7 },
    });

    expect(readInk(image, 30, 47)).toBeGreaterThan(0.69);
    expect(readInk(image, 33, 196)).toBeGreaterThan(0.69);
    expect(readInk(image, 30, 65)).toBeLessThan(0.01);
    expect(readInk(image, 300, 47)).toBeLessThan(0.01);
  });

  it.each([
    {
      side: 'слева',
      marginLineX: 100,
      margins: { top: 30, right: 0, bottom: 30, left: 110 },
      outerX: 50,
    },
    {
      side: 'справа',
      marginLineX: 500,
      margins: { top: 30, right: 110, bottom: 30, left: 0 },
      outerX: 550,
    },
  ])(
    'рисует линейку другого шага за линией поля $side',
    ({ marginLineX, margins, outerX }) => {
      const image = createSyntheticSheet({
        width: WIDTH,
        height: HEIGHT,
        step: STEP,
        phase: 15,
        margins,
        marginLineX,
        outerRuling: { step: 17, phase: 4 },
      });

      expect(readInk(image, outerX, 38)).toBeGreaterThan(LINE_DARKNESS * 0.9);
      expect(readInk(image, 300, 38)).toBeLessThan(0.01);
      expect(readInk(image, 300, 45)).toBeGreaterThan(LINE_DARKNESS * 0.9);
    }
  );

  it('ослабляет линии в пятне пониженного контраста', () => {
    const image = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      step: STEP,
      phase: 15,
      lowContrastArea: { left: 0, top: 100, right: 200, bottom: 300, contrast: 0.25 },
    });

    expect(readInk(image, 100, 135)).toBeCloseTo(LINE_DARKNESS * 0.25, 3);
    expect(readInk(image, 400, 135)).toBeCloseTo(LINE_DARKNESS, 3);
    expect(readInk(image, 100, 45)).toBeCloseTo(LINE_DARKNESS, 3);
  });
});
