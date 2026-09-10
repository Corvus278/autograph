import type { LightingField } from '../lib/paper/paper.types';

/**
 * Отражает поле освещения по горизонтали.
 *
 * Нужно там же, где отражается фотография листа: свет на снимке приходит с
 * одной стороны, и на правой половине разворота тёмный край оказывается у
 * противоположного поля. Не отрази поле вместе с листом — чернила гасли бы на
 * освещённой части и светлели на затенённой, то есть ровно наоборот.
 *
 * Карта текстуры при этом не отражается: в ней зерно бумаги, оно
 * высокочастотное и одинаково выглядит с любой стороны, а лишний проход по
 * полноразмерной картинке стоит дороже, чем даёт.
 *
 * @param field — поле освещения экземпляра; `null` — поля нет
 * @returns отражённое поле; `null` — отражать нечего
 */
export const mirrorLightingField = (
  field: LightingField | null
): LightingField | null => {
  if (!field) {
    return null;
  }

  const { gridWidth, gridHeight, values } = field;

  if (0 >= gridWidth || 0 >= gridHeight) {
    return field;
  }

  const mirrored = values.map((_value, index) => {
    const row = Math.floor(index / gridWidth);
    const column = index % gridWidth;

    return values[row * gridWidth + (gridWidth - 1 - column)] || 0;
  });

  return { ...field, values: mirrored };
};
