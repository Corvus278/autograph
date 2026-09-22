import type { SheetImageData } from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticColumnX,
  computeSyntheticMarginLineX,
  createHeldOutSheet,
  type HeldOutSheet,
  type HeldOutSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Допуск на отношение глубины вставной вертикали к соседям — пять процентов
 * из задачи 3.2.
 */
const RATIO_TOLERANCE = 0.05;

/**
 * Полуширина окна, в котором складывается провал линии поперёк неё: три
 * с лишним сигмы линии разлиновки. Провал складывается, а не берётся самым
 * тёмным пикселем: у самого тёмного глубина зависит от того, куда между
 * пикселями попал центр линии, а сумма по окну — нет.
 */
const DEPTH_REACH = 4;

/**
 * Лист, на котором сходятся все параметры генератора разом: черта слева со
 * сносом и пятном, схождение клетки, градиент света и вставная вертикаль у
 * правой стороны.
 */
const BASE_PARAMS: HeldOutSheetParams = {
  marginLineSide: 'left',
  marginLineDrift: 1.2,
  convergence: 0.2,
  vanishingShare: 0.62,
  falseColumn: { side: 'right', ratio: 1.8, offset: 0.4, isOnPhase: true },
  widthLighting: 0.3,
  blot: { top: 0.3, bottom: 0.45 },
  seed: 7,
};

/**
 * Суммарный провал линии в строке кадра против бумаги рядом с ней: бумага
 * берётся в четверти шага по обе стороны, где уже нет ни этой линии, ни
 * соседней вертикали. Мера — по растру, без мерок детектора: мерка детектора
 * не может проверять вход, по которому проверяют детектор.
 *
 * @param image — растр листа
 * @param center — столбец центра линии в этой строке
 * @param y — строка кадра
 * @param step — шаг разлиновки
 * @returns сумма провала по окну поперёк линии
 */
const measureRowDepth = (
  image: SheetImageData,
  center: number,
  y: number,
  step: number
): number => {
  const { width, luminance } = image;
  const row = y * width;
  const paper =
    ((luminance[row + Math.round(center - step / 4)] || 0) +
      (luminance[row + Math.round(center + step / 4)] || 0)) /
    2;
  const middle = Math.round(center);
  let depth = 0;

  for (let x = middle - DEPTH_REACH; x <= middle + DEPTH_REACH; x += 1) {
    depth += paper - (luminance[row + x] || 0);
  }

  return depth;
};

/**
 * Средний провал вертикали по строкам области с линиями. Строки у
 * горизонтальных линий пропускаются: на пересечении чернила двух линий
 * складываются, и яркость упирается в ноль у глубокой вертикали, а у
 * обычной — нет.
 *
 * @param sheet — лист генератора
 * @param index — номер вертикали на гребёнке, дробный — место между
 *   вертикалями
 * @returns средний провал
 */
const measureColumnDepth = (sheet: HeldOutSheet, index: number): number => {
  const { image, params } = sheet;
  const { height, step, phase, margins } = params;
  let total = 0;
  let count = 0;

  for (let y = margins.top; y < height - margins.bottom; y += 1) {
    const offset = (((y - phase) % step) + step) % step;

    if (Math.min(offset, step - offset) > DEPTH_REACH) {
      total += measureRowDepth(image, computeSyntheticColumnX(params, index, y), y, step);
      count += 1;
    }
  }

  return total / count;
};

/**
 * Отношение провала вставной вертикали к среднему провалу двух соседних
 * вертикалей клетки.
 *
 * @param sheet — лист генератора
 * @param isOnPhase — вертикаль стоит на фазе клетки: соседи — через шаг от
 *   неё, а не по обе стороны в полшага
 * @returns отношение глубин по растру
 */
const measureFalseColumnRatio = (sheet: HeldOutSheet, isOnPhase: boolean): number => {
  const { falseColumnX, params } = sheet;
  const index = ((falseColumnX || 0) - params.phase) / params.step;
  const [previous, next] = isOnPhase
    ? [index - 1, index + 1]
    : [Math.floor(index), Math.ceil(index)];
  const peers =
    (measureColumnDepth(sheet, previous) + measureColumnDepth(sheet, next)) / 2;

  return measureColumnDepth(sheet, index) / peers;
};

describe('createHeldOutSheet: повторяемость', () => {
  it('при тех же параметрах растр совпадает бит в бит', () => {
    const first = createHeldOutSheet(BASE_PARAMS);
    const second = createHeldOutSheet(BASE_PARAMS);

    expect(second.image.luminance).toStrictEqual(first.image.luminance);
  });

  it('другой seed даёт другой растр', () => {
    const first = createHeldOutSheet(BASE_PARAMS);
    const second = createHeldOutSheet({ ...BASE_PARAMS, seed: BASE_PARAMS.seed + 1 });

    expect(second.image.luminance).not.toStrictEqual(first.image.luminance);
  });
});

describe('createHeldOutSheet: вставная вертикаль', () => {
  it.each([
    { ratio: 1.2, offset: 0.1, isOnPhase: true, widthLighting: 0.3 },
    { ratio: 2.5, offset: 3, isOnPhase: true, widthLighting: -0.3 },
    { ratio: 1.2, offset: 0.1, isOnPhase: false, widthLighting: 0 },
    { ratio: 2.5, offset: 3, isOnPhase: false, widthLighting: 0.3 },
  ])(
    'отношение $ratio, $offset шага в трети, на фазе: $isOnPhase',
    ({ ratio, offset, isOnPhase, widthLighting }) => {
      const sheet = createHeldOutSheet({
        ...BASE_PARAMS,
        falseColumn: { side: 'right', ratio, offset, isOnPhase },
        widthLighting,
      });

      const measured = measureFalseColumnRatio(sheet, isOnPhase);

      expect(Math.abs(measured / ratio - 1)).toBeLessThanOrEqual(RATIO_TOLERANCE);
    }
  );

  it('стоит в своей трети и на фазе или посередине между вертикалями', () => {
    const { width } = createHeldOutSheet(BASE_PARAMS).params;
    const onPhase = createHeldOutSheet({
      ...BASE_PARAMS,
      falseColumn: { side: 'left', ratio: 2, offset: 0, isOnPhase: true },
    });
    const offPhase = createHeldOutSheet({
      ...BASE_PARAMS,
      falseColumn: { side: 'right', ratio: 2, offset: 0, isOnPhase: false },
    });

    const toPhaseShare = (sheet: HeldOutSheet): number => {
      const { falseColumnX, params } = sheet;
      const cycles = ((falseColumnX || 0) - params.phase) / params.step;

      return cycles - Math.floor(cycles);
    };

    expect(onPhase.falseColumnX).toBeLessThan(width / 3);
    expect(toPhaseShare(onPhase)).toBeCloseTo(0, 9);
    expect(offPhase.falseColumnX).toBeGreaterThan((2 * width) / 3);
    expect(toPhaseShare(offPhase)).toBeCloseTo(0.5, 9);
  });

  it('нулевое отношение — вертикали нет', () => {
    const sheet = createHeldOutSheet({
      ...BASE_PARAMS,
      falseColumn: { side: 'right', ratio: 0, offset: 1, isOnPhase: true },
    });

    expect(sheet.falseColumnX).toBeNull();
    expect(sheet.params.deepColumn).toBeNull();
    expect(sheet.params.strayColumn).toBeNull();
  });
});

describe('createHeldOutSheet: класс по построению', () => {
  it.each(['left', 'right'] as const)(
    'черта у стороны %s — самое внутреннее положение по высоте области',
    (side) => {
      const sheet = createHeldOutSheet({ ...BASE_PARAMS, marginLineSide: side });
      const { height, margins } = sheet.params;
      const positions: number[] = [];

      for (let y = margins.top; y <= height - margins.bottom; y += 1) {
        positions.push(computeSyntheticMarginLineX(sheet.params, y) || 0);
      }

      expect(sheet.hasMarginLine).toBe(true);
      expect(sheet.marginLineSide).toBe(side);
      expect(sheet.innermostX).toBeCloseTo(
        side === 'left' ? Math.max(...positions) : Math.min(...positions),
        6
      );
    }
  );

  it('без стороны черты на листе нет', () => {
    const sheet = createHeldOutSheet({ ...BASE_PARAMS, marginLineSide: null });

    expect(sheet.hasMarginLine).toBe(false);
    expect(sheet.marginLineSide).toBeNull();
    expect(sheet.innermostX).toBeNull();
    expect(sheet.params.marginLineX).toBeNull();
  });
});
