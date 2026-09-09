import type { SceneComposeParams } from '../lib/export/export.types';

/**
 * Чем снимать страницу, как собирать композицию и как отдавать файл. Всё —
 * отдельными зависимостями: так проверяется поведение при отказе рендера.
 */
export type ExportDeps = {
  /**
   * Снимает PNG с узла страницы и отдаёт data URL.
   */
  renderPage: (node: HTMLElement) => Promise<string>;

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
