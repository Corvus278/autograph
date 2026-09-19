import type { RealismLevel, RealismLevelId } from './config.types';

/**
 * Ступени реализма почерка по порядку — от ровного письма к небрежному.
 *
 * Частота слова — «каждое N-е слово получает побуквенные искажения», поэтому
 * к небрежной ступени она падает, а верхняя граница искажаемых букв в слове
 * растёт. Числа подобраны на глаз; спека держит только порядок, дефолт и
 * крайние ступени.
 *
 * Подмена шрифта буквы не включена ни на одной ступени: чужой шрифт в слове
 * читается как сбой набора, а не как рука. Она остаётся экспертной
 * настройкой.
 */
export const REALISM_LEVELS: readonly RealismLevel[] = [
  {
    id: 'even',
    label: 'Ровно',
    flags: {
      isWordRotated: false,
      isWordSkewed: false,
      isWordShifted: false,
      isLetterSpacingRandom: false,
      isLetterFontRandom: false,
      isLineRotated: false,
      isLineShifted: false,
    },
    wordFrequency: 1,
    letterFrequency: 1,
    hasContourVariance: false,
  },
  {
    id: 'neat',
    label: 'Аккуратно',
    flags: {
      isWordRotated: true,
      isWordSkewed: false,
      isWordShifted: false,
      isLetterSpacingRandom: false,
      isLetterFontRandom: false,
      isLineRotated: false,
      isLineShifted: true,
    },
    wordFrequency: 4,
    letterFrequency: 1,
    hasContourVariance: true,
  },
  {
    id: 'normal',
    label: 'Обычно',
    flags: {
      isWordRotated: true,
      isWordSkewed: true,
      isWordShifted: true,
      isLetterSpacingRandom: true,
      isLetterFontRandom: false,
      isLineRotated: false,
      isLineShifted: true,
    },
    wordFrequency: 2,
    letterFrequency: 2,
    hasContourVariance: true,
  },
  {
    id: 'sloppy',
    label: 'Небрежно',
    flags: {
      isWordRotated: true,
      isWordSkewed: true,
      isWordShifted: true,
      isLetterSpacingRandom: true,
      isLetterFontRandom: false,
      isLineRotated: true,
      isLineShifted: true,
    },
    wordFrequency: 1,
    letterFrequency: 3,
    hasContourVariance: true,
  },
];

/**
 * Ступень по умолчанию: с включёнными искажениями, а не ровное письмо —
 * ровный набор первым делом и выдаёт генератор.
 */
export const DEFAULT_REALISM_LEVEL_ID: RealismLevelId = 'normal';
