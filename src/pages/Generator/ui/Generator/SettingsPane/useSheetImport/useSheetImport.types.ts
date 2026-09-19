import type { PaperFamily } from '../../../../lib/paper';

/**
 * С чем добавляется фотография листа.
 */
export type SheetImportOptions = {
  /**
   * Семья, в которую добавляется экземпляр.
   */
  family: PaperFamily;

  /**
   * Лист без разлиновки. Разлиновка на таком не ищется: искать нечего, шаг
   * строк задаёт пользователь.
   */
  isBlank: boolean;
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
