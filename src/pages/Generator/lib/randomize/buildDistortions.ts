import { mulberry32, pickRandomItems, randomInt } from '@shared/lib/random';

import type {
  BuildDistortionsOptions,
  LetterDistortion,
  WordDistortion,
} from './randomize.types';

/**
 * Границы искажений подобраны по старому генератору: поворот и сдвиг —
 * единицы, скос — заметно больше, иначе наклон почерка не читается.
 */
const WORD_ROTATE_RANGE = [-2, 2] as const;
const WORD_SKEW_RANGE = [-8, 8] as const;
const WORD_SHIFT_RANGE = [-2, 2] as const;
const LETTER_SPACING_RANGE = [-2, 3] as const;

/**
 * Слова короче трёх символов побуквенно не искажаются: на двух буквах разнобой
 * шрифтов читается как опечатка, а не как почерк.
 */
const MIN_LETTER_DISTORTION_LENGTH = 3;

/**
 * Собирает искажения букв одного слова. Возвращает пустой список, если ни одно
 * побуквенное искажение не включено или слово слишком короткое.
 */
const buildLetterDistortions = (
  word: string,
  random: () => number,
  options: BuildDistortionsOptions
): LetterDistortion[] => {
  const { flags, wordFrequency, letterFrequency, substituteFonts } = options;
  const { isLetterSpacingRandom, isLetterFontRandom } = flags;

  if (!isLetterSpacingRandom && !isLetterFontRandom) {
    return [];
  }

  if (word.length < MIN_LETTER_DISTORTION_LENGTH) {
    return [];
  }

  if (randomInt(random, 1, wordFrequency) !== 1) {
    return [];
  }

  const lettersLimit = Math.min(letterFrequency, word.length);
  const indexes = [...word].map((_letter, index) => {
    return index;
  });
  const picked = pickRandomItems(random, indexes, randomInt(random, 1, lettersLimit));

  return picked.map((index) => {
    const fontIndex = randomInt(random, 0, Math.max(substituteFonts.length - 1, 0));

    return {
      index,
      letterSpacing: isLetterSpacingRandom
        ? randomInt(random, ...LETTER_SPACING_RANGE)
        : null,
      fontFamily:
        isLetterFontRandom && substituteFonts.length > 0
          ? (substituteFonts[fontIndex] ?? null)
          : null,
    };
  });
};

/**
 * Превращает слова страницы в описания искажений: по описанию на слово, в том
 * же порядке. Ничего не рисует и не трогает DOM — раскладывать результат в
 * стили будет React.
 */
export const buildDistortions = (
  words: string[],
  options: BuildDistortionsOptions
): WordDistortion[] => {
  const { flags, seed } = options;
  const random = mulberry32(seed);

  return words.map((word) => {
    return {
      rotate: flags.isWordRotated ? randomInt(random, ...WORD_ROTATE_RANGE) : 0,
      skew: flags.isWordSkewed ? randomInt(random, ...WORD_SKEW_RANGE) : 0,
      translateY: flags.isWordShifted ? randomInt(random, ...WORD_SHIFT_RANGE) : 0,
      letters: buildLetterDistortions(word, random, options),
    };
  });
};
