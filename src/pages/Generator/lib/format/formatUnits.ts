import { formatNumber, NBSP, roundTo } from './formatNumber';

/**
 * Поправки в долях шага идут шагом 0,01–0,1: сотых хватает, чтобы соседние
 * положения слайдера подписывались по-разному.
 */
const STEP_FRACTION_DIGITS = 2;

/**
 * Поворот в сцене целый, но десятая оставлена на случай дробного шага.
 */
const DEGREE_FRACTION_DIGITS = 1;

const PERCENT_FRACTION_DIGITS = 1;

const PERCENT_SCALE = 100;

/**
 * Форма слова «шаг» по правилу множественного числа. Дробное число
 * (`other`) согласуется с родительным падежом единственного: «0,25 шага».
 */
const STEP_WORD_BY_PLURAL: Record<Intl.LDMLPluralRule, string> = {
  zero: 'шагов',
  one: 'шаг',
  two: 'шага',
  few: 'шага',
  many: 'шагов',
  other: 'шага',
};

const PLURAL_RULES = new Intl.PluralRules('ru-RU');

/**
 * Доли шага разлиновки со знаком: поправка геометрии сдвигает текст
 * относительно вычисленного, и направление сдвига важнее самой величины.
 *
 * @param value — поправка в долях шага
 * @returns например «+0,25 шага», «−2 шага», «0 шагов»
 */
export const formatStepFraction = (value: number): string => {
  const rounded = Math.abs(roundTo(value, STEP_FRACTION_DIGITS));
  const word = STEP_WORD_BY_PLURAL[PLURAL_RULES.select(rounded)];
  const number = formatNumber(value, {
    fractionDigits: STEP_FRACTION_DIGITS,
    isSigned: true,
  });

  return `${number}${NBSP}${word}`;
};

/**
 * Градусы. Знак градуса ставится вплотную к числу.
 *
 * @param value — угол в градусах
 * @returns например «5°», «−3°»
 */
export const formatDegrees = (value: number): string => {
  const number = formatNumber(value, {
    fractionDigits: DEGREE_FRACTION_DIGITS,
    isSigned: false,
  });

  return `${number}°`;
};

/**
 * Пиксели кадра листа, целые: доли пикселя на фотографии не видны.
 *
 * @param value — величина в пикселях
 * @returns например «12 px»
 */
export const formatPixels = (value: number): string => {
  const number = formatNumber(value, { fractionDigits: 0, isSigned: false });

  return `${number}${NBSP}px`;
};

/**
 * Проценты из доли: настройки хранят долю единицы, а человеку привычнее
 * проценты.
 *
 * @param value — доля, где 1 — сто процентов
 * @returns например «6 %»
 */
export const formatPercent = (value: number): string => {
  const number = formatNumber(value * PERCENT_SCALE, {
    fractionDigits: PERCENT_FRACTION_DIGITS,
    isSigned: false,
  });

  return `${number}${NBSP}%`;
};
