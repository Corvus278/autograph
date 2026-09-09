import type { WordDistortion } from '../../../../../lib/randomize/randomize.types';

export type PageWordProps = {
  /**
   * Текст слова.
   */
  text: string;

  /**
   * Искажения этого слова.
   */
  distortion: WordDistortion;
};
