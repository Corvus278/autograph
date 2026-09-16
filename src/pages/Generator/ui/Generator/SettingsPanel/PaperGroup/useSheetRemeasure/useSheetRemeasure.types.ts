import type { PaperFamily, PaperMargins, PaperSheet } from '../../../../../lib/paper';

/**
 * Что и в каких границах перемерить.
 */
export type SheetRemeasureOptions = {
  /**
   * Семья, в которой лежит лист: её вид разлиновки решает, искать ли линии.
   */
  family: PaperFamily;

  /**
   * Перемеряемый лист.
   */
  sheet: PaperSheet;

  /**
   * Границы листа — отступы от краёв кадра в пикселях фотографии.
   */
  bounds: PaperMargins;
};

/**
 * Перемер своего листа в границах, заданных руками.
 */
export type SheetRemeasure = {
  /**
   * Проверяет границы, измеряет фотографию внутри них и заменяет
   * характеристики листа.
   */
  remeasure: (options: SheetRemeasureOptions) => Promise<void>;

  /**
   * Идёт перемер.
   */
  isBusy: boolean;

  /**
   * Сообщение об ошибке. `null` — ошибки нет.
   */
  error: string | null;

  /**
   * Сколько перемеров применено: формы листа, начальные значения которых
   * берутся из его характеристик, пересоздаются по смене этого числа.
   */
  revision: number;
};
