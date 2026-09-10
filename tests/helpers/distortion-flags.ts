import type { DistortionFlags } from '@pages/Generator/lib/randomize/randomize.types';

/**
 * Все искажения почерка включены: рецепт флаги не выводит, а передаёт как
 * есть, и с включёнными это видно.
 */
export const ALL_DISTORTION_FLAGS: DistortionFlags = {
  isWordRotated: true,
  isWordSkewed: true,
  isWordShifted: true,
  isLetterSpacingRandom: true,
  isLetterFontRandom: true,
  isLineRotated: true,
  isLineShifted: true,
};

/**
 * Все искажения выключены: слова рисуются ровно там, где их положила
 * раскладка, — по такому снимку координаты проверяются в уме.
 */
export const NO_DISTORTION_FLAGS: DistortionFlags = {
  isWordRotated: false,
  isWordSkewed: false,
  isWordShifted: false,
  isLetterSpacingRandom: false,
  isLetterFontRandom: false,
  isLineRotated: false,
  isLineShifted: false,
};
