import { FREQUENCY_RANGE } from '../../config/defaults';

/**
 * Словесная шкала частот от самой редкой к самой частой. Длина шкалы совпадает
 * с диапазоном слайдера частот.
 */
const FREQUENCY_WORDS = [
  'очень редко',
  'редко',
  'иногда',
  'часто',
  'очень часто',
] as const;

/**
 * Номер ступени шкалы для значения частоты. Значение вне диапазона
 * прижимается к краю, дробное — округляется: подпись показывается всегда.
 *
 * @param value — значение частоты
 * @returns индекс ступени в `FREQUENCY_WORDS`, 0 — самая редкая
 */
const toStepIndex = (value: number): number => {
  const { min, max } = FREQUENCY_RANGE;
  const clamped = Math.min(max, Math.max(min, Math.round(value)));

  return clamped - min;
};

const toWord = (index: number): string => {
  return FREQUENCY_WORDS[index] || FREQUENCY_WORDS[0];
};

/**
 * Частота искажённых букв в слове: чем больше число, тем больше букв
 * искажается, то есть тем чаще.
 *
 * @param value — `letterFrequency`, 1–5
 * @returns слово шкалы: 1 — «очень редко», 5 — «очень часто»
 */
export const formatLetterFrequency = (value: number): string => {
  return toWord(toStepIndex(value));
};

/**
 * Частота искажённых слов. Шкала обратная: `wordFrequency` — «каждое N-е
 * слово», поэтому 1 — каждое слово, то есть чаще всего.
 *
 * @param value — `wordFrequency`, 1–5
 * @returns слово шкалы: 1 — «очень часто», 5 — «очень редко»
 */
export const formatWordFrequency = (value: number): string => {
  return toWord(FREQUENCY_WORDS.length - 1 - toStepIndex(value));
};
