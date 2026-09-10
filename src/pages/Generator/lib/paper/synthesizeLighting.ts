import { mulberry32 } from '@shared/lib/random';

import { percentileOf, resolveLightingGrid } from './extractLighting';
import type { LightingField } from './paper.types';

/**
 * Границы наклона градиента: доля, на которую дальний от источника край листа
 * темнее ближнего. Нижняя граница заведомо выше порога пригодности поля,
 * иначе синтетический свет выглядел бы как тот самый скан, вместо которого он
 * подставлен. Верхняя удерживает свет мягким: сильнее — и лист читается как
 * подсвеченный фонариком сбоку.
 */
const GRADIENT_MIN = 0.12;
const GRADIENT_MAX = 0.24;

/**
 * Границы виньетки: доля, на которую угол листа темнее центра. Виньетка
 * отвечает за то, чего не даёт градиент, — падение света к краям кадра, по
 * которому снимок и отличается от равномерной заливки.
 */
const VIGNETTE_MIN = 0.06;
const VIGNETTE_MAX = 0.16;

/**
 * Перцентили размаха те же, что у извлечённого поля: `contrast` обоих
 * источников читается одной меркой, иначе синтетический свет пришлось бы
 * сравнивать с порогом по своей шкале.
 */
const CONTRAST_LOW_PERCENTILE = 0.05;
const CONTRAST_HIGH_PERCENTILE = 0.95;

/**
 * Синтезирует поле освещения для источников, у которых своё поле непригодно:
 * мягкий градиент со случайным направлением плюс виньетка.
 *
 * Все параметры выводятся из seed, поэтому один и тот же лист освещён
 * одинаково при каждом рендере — иначе перерисовка меняла бы свет на
 * странице.
 *
 * @param width — ширина листа в пикселях: по ней берутся пропорции сетки
 * @param height — высота листа в пикселях
 * @param seed — seed прогона
 * @returns поле освещения, пригодное к использованию по построению
 */
export const synthesizeLighting = (
  width: number,
  height: number,
  seed: number
): LightingField => {
  const { gridWidth, gridHeight } = resolveLightingGrid(
    Math.max(1, width),
    Math.max(1, height)
  );
  const random = mulberry32(seed);
  const angle = random() * 2 * Math.PI;
  const gradient = GRADIENT_MIN + random() * (GRADIENT_MAX - GRADIENT_MIN);
  const vignette = VIGNETTE_MIN + random() * (VIGNETTE_MAX - VIGNETTE_MIN);
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const cells = new Float32Array(gridWidth * gridHeight);

  for (let row = 0; row < gridHeight; row += 1) {
    const offsetY = gridHeight > 1 ? row / (gridHeight - 1) - 0.5 : 0;

    for (let column = 0; column < gridWidth; column += 1) {
      const offsetX = gridWidth > 1 ? column / (gridWidth - 1) - 0.5 : 0;
      const projection = offsetX * directionX + offsetY * directionY;
      const radius = 2 * (offsetX * offsetX + offsetY * offsetY);

      cells[row * gridWidth + column] =
        (1 - gradient * projection) * (1 - vignette * radius);
    }
  }

  const sorted = Float32Array.from(cells).sort();
  const brightest = sorted[sorted.length - 1] || 1;
  const high = percentileOf(sorted, CONTRAST_HIGH_PERCENTILE);
  const low = percentileOf(sorted, CONTRAST_LOW_PERCENTILE);

  return {
    gridWidth,
    gridHeight,
    values: Array.from(cells, (cell) => {
      return cell / brightest;
    }),
    contrast: high > 0 ? 1 - low / high : 0,
    isUsable: true,
  };
};
