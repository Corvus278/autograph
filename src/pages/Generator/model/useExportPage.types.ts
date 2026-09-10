import type { SceneComposeParams } from '../lib/export/export.types';

import type { PageRenderTask } from './pageTask.types';

/**
 * Чем растеризовать страницу, как собирать композицию и как отдавать файл.
 * Всё — отдельными зависимостями: так проверяется поведение при отказе
 * отрисовки.
 */
export type ExportDeps = {
  /**
   * Растеризует страницу в повышенном разрешении и отдаёт data URL.
   */
  renderPage: (task: PageRenderTask) => Promise<string>;

  /**
   * Вкладывает снимок страницы в сцену.
   */
  composeScene: (
    pageDataUrl: string,
    sceneSrc: string,
    params: SceneComposeParams
  ) => Promise<string>;

  /**
   * Отдаёт готовый файл пользователю.
   */
  download: (dataUrl: string, fileName: string) => void;
};

/**
 * Сохранение результата: состояние ошибки и метод сохранения.
 */
export type ExportControl = {
  /**
   * Сообщение об ошибке отрисовки. `null` — ошибки нет.
   */
  error: string | null;

  /**
   * Идёт отрисовка снимка.
   */
  isSaving: boolean;

  /**
   * Сохраняет текущую страницу — саму по себе или вложенной в сцену.
   */
  save: () => Promise<void>;
};
