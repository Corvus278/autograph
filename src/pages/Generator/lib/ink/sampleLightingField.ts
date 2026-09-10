import type { LightingField } from '../paper/paper.types';

/**
 * Освещение, которое возвращается для пустого поля. Единица — яркость самого
 * светлого узла: поле нормировано на него, поэтому такое значение оставляет
 * чернила нетронутыми, а не гасит их наугад.
 */
const NEUTRAL_LIGHTING = 1;

/**
 * Зажимает значение в отрезок.
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Билинейная выборка поля освещения в произвольной точке листа.
 *
 * Сетка натянута на лист узлами, а не клетками: точка `0` попадает в центр
 * первого узла, точка `1` — в центр последнего. Так выборка в узле возвращает
 * ровно его значение, и то же отображение задаётся текстурной координате в
 * шейдере — иначе свет в предпросмотре ехал бы на полклетки относительно
 * экспорта.
 *
 * Значения поля нормированы на самый светлый узел, поэтому результат лежит в
 * `[0, 1]` и единица означает «самая светлая часть листа». За пределами листа
 * координаты зажимаются: край поля продолжается наружу, а не обнуляется.
 *
 * @param field — поле освещения экземпляра листа
 * @param u — доля ширины листа, 0 — левый край, 1 — правый
 * @param v — доля высоты листа, 0 — верх, 1 — низ
 * @returns яркость в точке; для пустого поля — нейтральная единица
 */
export const sampleLightingField = (
  field: LightingField,
  u: number,
  v: number
): number => {
  const { gridWidth, gridHeight, values } = field;

  if (0 >= gridWidth || 0 >= gridHeight) {
    return NEUTRAL_LIGHTING;
  }

  const x = clamp(u, 0, 1) * (gridWidth - 1);
  const y = clamp(v, 0, 1) * (gridHeight - 1);
  const left = Math.floor(x);
  const top = Math.floor(y);
  const right = Math.min(left + 1, gridWidth - 1);
  const bottom = Math.min(top + 1, gridHeight - 1);
  const weightX = x - left;
  const weightY = y - top;
  const topLeft = values[top * gridWidth + left] || 0;
  const topRight = values[top * gridWidth + right] || 0;
  const bottomLeft = values[bottom * gridWidth + left] || 0;
  const bottomRight = values[bottom * gridWidth + right] || 0;
  const upper = topLeft + (topRight - topLeft) * weightX;
  const lower = bottomLeft + (bottomRight - bottomLeft) * weightX;

  return upper + (lower - upper) * weightY;
};
