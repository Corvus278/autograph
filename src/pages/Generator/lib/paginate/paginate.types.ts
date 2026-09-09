import type { TextMeasurer } from '../measure/measure.types';
import type { Line } from '../split/splitParagraphs.types';

/**
 * Страница — набор строк, помещающихся в высоту фона. Строка целиком
 * принадлежит одной странице: пополам её не режем.
 */
export type Page = {
  /**
   * Строки страницы в порядке отрисовки. Пустой массив — пустая страница,
   * такая получается при пустом тексте.
   */
  lines: Line[];
};

export type PaginateOptions = {
  /**
   * Высота в пикселях, доступная под текст: высота фона за вычетом
   * вертикального сдвига и нижнего поля.
   */
  availableHeight: number;

  /**
   * Измеритель, у которого спрашивается высота строки.
   */
  measure: TextMeasurer;
};
