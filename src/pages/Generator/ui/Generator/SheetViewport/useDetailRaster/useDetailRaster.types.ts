import type { PageRenderTask, RunRenderPlan } from '../../../../model/pageTask.types';

/**
 * Чем рисовать детальный растр и как отдавать его картинкой. В приложении —
 * воркер и адреса объектов, в тестах — подделки.
 */
export type DetailRasterDeps = {
  /**
   * Отрисовывает страницу по заданию вне основного потока. Отказ — страница
   * не отрисовалась или заказ отменён.
   */
  renderPage: (task: PageRenderTask, signal: AbortSignal) => Promise<Blob>;

  /**
   * Делает из готовой страницы адрес для `<img>`.
   */
  createObjectUrl: (page: Blob) => string;

  /**
   * Освобождает адрес страницы, которая больше не показывается.
   */
  revokeObjectUrl: (url: string) => void;
};

export type DetailRasterInput = {
  /**
   * План отрисовки прогона; `null` — страница ещё не готова.
   */
  plan: RunRenderPlan | null;

  /**
   * Нужное разрешение детального растра; `null` — основного растра хватает.
   */
  scale: number | null;

  /**
   * Подмена зависимостей; по умолчанию — воркер приложения.
   */
  deps?: Partial<DetailRasterDeps>;

  /**
   * Какую страницу рисовать, считая с нуля; по умолчанию — показанную страницу
   * плана. Разворот просит так вторую страницу пары.
   */
  pageIndex?: number;
};

/**
 * Готовый детальный растр вместе с правкой, для которой он нарисован.
 */
export type DetailRaster = {
  /**
   * Адрес готовой страницы.
   */
  url: string;

  /**
   * Номер правки, на которой страница заказана.
   */
  revision: number;
};
