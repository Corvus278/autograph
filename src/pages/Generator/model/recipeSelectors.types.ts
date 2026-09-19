import type { DistortionFlags } from '../lib/randomize/randomize.types';

/**
 * Величины рецепта прогона, которые нужны отрисовке страницы.
 */
export type PageRecipeValues = {
  /**
   * Цвет чернил: ручной выбор или цвет рецепта в режиме «Авто».
   */
  inkColor: string;

  /**
   * Seed почерка прогона: из него выводится рисунок неровности.
   */
  handwritingSeed: number;

  /**
   * Включённые виды искажений почерка.
   */
  flags: DistortionFlags;

  /**
   * Как часто слово попадает под побуквенные искажения.
   */
  wordFrequency: number;

  /**
   * Верхняя граница числа искажаемых букв в слове.
   */
  letterFrequency: number;

  /**
   * Качество кодирования снимка.
   */
  jpegQuality: number;
};
