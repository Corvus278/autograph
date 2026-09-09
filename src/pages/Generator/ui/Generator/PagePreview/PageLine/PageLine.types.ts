import type {
  LineDistortion,
  WordDistortion,
} from '../../../../lib/randomize/randomize.types';

/**
 * Слово строки вместе с его искажениями.
 */
export type PageLineWord = {
  /**
   * Текст слова.
   */
  text: string;

  /**
   * Искажения этого слова.
   */
  distortion: WordDistortion;
};

export type PageLineProps = {
  /**
   * Слова строки в порядке отрисовки. Пустой массив — пустая строка между
   * абзацами.
   */
  words: PageLineWord[];

  /**
   * Искажения строки целиком.
   */
  distortion: LineDistortion;

  /**
   * Добавка к межстрочному интервалу в пикселях.
   */
  spacing: number;
};
