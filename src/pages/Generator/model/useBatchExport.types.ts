import type { BatchPacker, BatchProgress } from '../lib/batch';

import type { PageRenderTask } from './pageTask.types';

/**
 * Чем выгружается пачка: отрисовка страницы, упаковщик и отдача архива. Всё
 * отдельными зависимостями — настоящего растра и настоящего скачивания в
 * тестах нет.
 */
export type BatchExportDeps = {
  /**
   * Отрисовывает одну страницу и отдаёт её файлом. Отказ — страница не
   * отрисовалась, пачка на ней не останавливается.
   */
  renderPage: (task: PageRenderTask, signal?: AbortSignal | undefined) => Promise<Blob>;

  /**
   * Создаёт упаковщик пачки под известное число страниц.
   */
  createPacker: (pageCount: number) => BatchPacker;

  /**
   * Отдаёт архив пользователю.
   */
  download: (archive: Blob, fileName: string) => void;
};

/**
 * Выгрузка пачки: прогресс, сообщение об исходе и управление.
 */
export type BatchExportControl = {
  /**
   * Сколько страниц готово и сколько их всего. `null` — выгрузка не идёт.
   */
  progress: BatchProgress | null;

  /**
   * Чем кончилась выгрузка: отказ или список неудавшихся страниц. `null` —
   * сказать нечего.
   */
  error: string | null;

  /**
   * Идёт выгрузка пачки.
   */
  isRunning: boolean;

  /**
   * Запускает выгрузку всех страниц прогона одним архивом.
   */
  start: () => Promise<void>;

  /**
   * Отменяет идущую выгрузку.
   */
  cancel: () => void;
};
