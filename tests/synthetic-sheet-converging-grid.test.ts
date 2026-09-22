import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticColumnX,
  CONVERGING_GRID_SHEET,
  createSyntheticSheet,
} from './helpers/synthetic-sheet';

/**
 * Полуширина окна, в котором ищется провал вертикали в профиле, в долях шага:
 * та же шестая доля, которой диагноз `IMG_1813` мерил вертикали клетки.
 */
const COLUMN_REACH_SHARE = 1 / 6;

/**
 * Во сколько раз самая резкая вертикаль клетки глубже самой размытой в
 * профиле во всю высоту. На `IMG_1813` отношение 0,082 / 0,029 — около трёх;
 * порог ниже живого, чтобы тест держал причину, а не число снимка.
 */
const MIN_DEPTH_SPREAD = 2.5;

/**
 * Профиль средней яркости столбцов по высоте области с линиями — своя мера
 * теста, а не профиль детектора: неоднородность клетки проверяется по растру,
 * иначе тест дефекта опирался бы на то, что сам же и ловит.
 *
 * @returns средняя яркость каждого столбца кадра
 */
const measureColumnMeans = (): Float64Array => {
  const { width, height, margins } = CONVERGING_GRID_SHEET;
  const { luminance } = createSyntheticSheet(CONVERGING_GRID_SHEET);
  const means = new Float64Array(width);
  const rows = height - margins.top - margins.bottom;

  for (let y = margins.top; y < height - margins.bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      means[x] = (means[x] || 0) + (luminance[y * width + x] || 0) / rows;
    }
  }

  return means;
};

/**
 * Глубина вертикали клетки в профиле во всю высоту: самый светлый столбец в
 * полшага по обе стороны минус самый тёмный у вертикали. Размах, а не разница
 * с бумагой посередине между вертикалями: у размытой вертикали провал
 * расплывается на весь шаг, и середина оказывается не светлее её самой.
 *
 * @param means — профиль средней яркости столбцов
 * @param index — номер вертикали на гребёнке
 * @returns глубина провала вертикали
 */
const measureColumnDepth = (means: Float64Array, index: number): number => {
  const { step, height } = CONVERGING_GRID_SHEET;
  const center = Math.round(
    computeSyntheticColumnX(CONVERGING_GRID_SHEET, index, height / 2)
  );
  const reach = Math.ceil(step * COLUMN_REACH_SHARE);
  const half = Math.round(step / 2);
  let lightest = Number.NEGATIVE_INFINITY;
  let darkest = Number.POSITIVE_INFINITY;

  for (let x = center - half; x <= center + half; x += 1) {
    lightest = Math.max(lightest, means[x] || 0);

    if (Math.abs(x - center) <= reach) {
      darkest = Math.min(darkest, means[x] || 0);
    }
  }

  return lightest - darkest;
};

describe('CONVERGING_GRID_SHEET: причина фантома IMG_1813', () => {
  it('глубина вертикалей клетки в профиле во всю высоту неоднородна по ширине', () => {
    const { width, step, phase, margins, columnConvergence } = CONVERGING_GRID_SHEET;
    const means = measureColumnMeans();
    const first = Math.ceil((margins.left + step - phase) / step);
    const last = Math.floor((width - margins.right - step - phase) / step);
    const depths: number[] = [];

    for (let index = first; index <= last; index += 1) {
      depths.push(measureColumnDepth(means, index));
    }

    const deepest = Math.max(...depths);
    const shallowest = Math.min(...depths);
    /**
     * Самая резкая вертикаль обязана стоять у столбца схождения: иначе
     * неоднородность шла бы не от схождения, а от чего-то ещё на листе.
     */
    const deepestX = computeSyntheticColumnX(
      CONVERGING_GRID_SHEET,
      first + depths.indexOf(deepest),
      CONVERGING_GRID_SHEET.height / 2
    );

    expect(deepest / shallowest).toBeGreaterThan(MIN_DEPTH_SPREAD);
    expect(Math.abs(deepestX - columnConvergence.x)).toBeLessThanOrEqual(step / 2);
  });

  it('вставной вертикали на листе нет — клетка одной глубины', () => {
    expect(CONVERGING_GRID_SHEET.deepColumn).toBeUndefined();
    expect(CONVERGING_GRID_SHEET.strayColumn).toBeUndefined();
  });

  /**
   * Тест фиксирует дефект базы: первая ступень отдаёт линию стороне с ровной
   * клеткой, хотя черта стоит слева. Вето переворачивает это утверждение.
   */
  it('нынешний детектор отдаёт линию поля у правой стороны', () => {
    const { width } = CONVERGING_GRID_SHEET;
    const detection = detectRuling(createSyntheticSheet(CONVERGING_GRID_SHEET), {
      skewAngle: 0,
    });

    expect(detection.marginLineSide).toBe('right');
    expect(detection.marginLineX).toBeGreaterThan((2 * width) / 3);
  });

  /**
   * Контроль причины: тот же лист с параллельными вертикалями. Не держи его
   * тест, фантом справа мог бы идти от чего угодно на листе, а не от схождения.
   */
  it('без схождения клетки тот же лист линию справа не получает', () => {
    const detection = detectRuling(
      createSyntheticSheet({ ...CONVERGING_GRID_SHEET, columnConvergence: null }),
      { skewAngle: 0 }
    );

    expect(detection.marginLineSide).not.toBe('right');
  });
});
