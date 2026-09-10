import type { PaperFamily, RulingDetection } from '../../../../../lib/paper';

/**
 * С чем добавляется фотография листа.
 */
export type SheetImportOptions = {
  /**
   * Семья, к канону которой приводится экземпляр.
   */
  family: PaperFamily;

  /**
   * Лист без разлиновки. Разлиновка на таком не ищется: искать нечего, шаг
   * строк задаёт пользователь.
   */
  isBlank: boolean;
};

/**
 * Измерения, снятые с фотографии.
 */
export type SheetMeasurement = {
  /**
   * Угол наклона разлиновки в кадре в градусах.
   */
  skewAngle: number;

  /**
   * Найденная разлиновка. `null` — не нашлась: экземпляр остаётся, а шаг и
   * поля задаются руками.
   */
  detection: RulingDetection | null;
};

/**
 * Добавление своей фотографии листа.
 */
export type SheetImport = {
  /**
   * Читает фотографию, измеряет её и добавляет экземпляр в семью.
   */
  add: (file: File, options: SheetImportOptions) => Promise<void>;

  /**
   * Идёт чтение и разбор фотографии.
   */
  isBusy: boolean;

  /**
   * Сообщение об ошибке чтения файла. `null` — ошибки нет.
   */
  error: string | null;
};
