import type { GeometryCorrection } from '../lib/calibrate/calibrate.types';

import type { ParameterRange } from './config.types';

/**
 * Ширина листа в предпросмотре: от неё считается высота страницы по
 * пропорциям фона.
 */
export const PAGE_WIDTH = 700;

/**
 * Значения по умолчанию.
 */
export const DEFAULT_BOTTOM_MARGIN = 0;
export const DEFAULT_SCENE_ROTATE = 0;
export const DEFAULT_SCENE_SHIFT_X = 0;
export const DEFAULT_SCENE_SHIFT_Y = 0;
export const DEFAULT_SCENE_SCALE = 0;
export const DEFAULT_SCENE_DARKEN = 0.06;

/**
 * Запас снизу в шагах разлиновки. Шаг слайдера — целый шаг разлиновки: на
 * линейке это ровно строка, и запас отнимает одинаковое число строк на листах
 * с любым шагом.
 */
export const BOTTOM_MARGIN_RANGE: ParameterRange = { min: 0, max: 20, step: 1 };

/**
 * Границы поправок геометрии в долях шага разлиновки — общие у слайдеров и у
 * чтения сессии: значение, которое слайдер выставить не мог, сессия не
 * восстанавливает. Поправка — дельта поверх вычисленного из разлиновки,
 * поэтому диапазоны симметричны нулю и узкие: широкий означал бы, что
 * автокалибровка промахнулась, и чинить надо её, а не двигать блок руками.
 *
 * Кегль и интервал — до четверти шага: кегль и так около шага, и больше
 * четверти уже меняет почерк, а не подгоняет его. Сдвиги — до двух шагов:
 * текст можно пересадить на соседние линии, но не увести с листа.
 */
export const GEOMETRY_CORRECTION_RANGES: Record<
  keyof GeometryCorrection,
  ParameterRange
> = {
  fontSizePx: { min: -0.25, max: 0.25, step: 0.01 },
  lineSpacing: { min: -0.25, max: 0.25, step: 0.01 },
  topOffset: { min: -2, max: 2, step: 0.05 },
  leftPadding: { min: -2, max: 2, step: 0.05 },
  blockWidth: { min: -4, max: 4, step: 0.1 },
};

export const FREQUENCY_RANGE: ParameterRange = { min: 1, max: 5, step: 1 };
export const SCENE_ROTATE_RANGE: ParameterRange = { min: -10, max: 10, step: 1 };
export const SCENE_SHIFT_RANGE: ParameterRange = { min: 0, max: 50, step: 1 };
export const SCENE_SCALE_RANGE: ParameterRange = { min: -150, max: 150, step: 1 };
export const SCENE_DARKEN_RANGE: ParameterRange = { min: 0, max: 0.1, step: 0.01 };

/**
 * Пустая поправка геометрии: все дельты по нулям — текст стоит ровно там, где
 * его посчитала автокалибровка. Нули, а не пропущенные поля: поправка
 * складывается с вычисленным на каждом пересчёте, и отсутствующая дельта
 * ничем не отличалась бы от нулевой, зато усложняла бы слияние правок.
 */
export const DEFAULT_GEOMETRY_CORRECTION: Required<GeometryCorrection> = {
  fontSizePx: 0,
  lineSpacing: 0,
  topOffset: 0,
  leftPadding: 0,
  blockWidth: 0,
};

/**
 * Seed первого прогона. Единица, а не случайное число: генератор открывается
 * одинаковым у всех, а рецепт всё равно меняется по явному действию.
 */
export const DEFAULT_RUN_SEED = 1;
