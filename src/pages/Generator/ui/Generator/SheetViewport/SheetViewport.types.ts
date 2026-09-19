import type { PageRenderSource } from '../../../model/pageRender.types';
import type { RunRenderPlan } from '../../../model/pageTask.types';

import type { DetailRasterDeps } from './useDetailRaster';

export type SheetViewportProps = {
  /**
   * Источник отрисовки текущей страницы для основного растра. `null` — рисовать
   * пока нечего.
   */
  source: PageRenderSource | null;

  /**
   * Источник второй страницы разворота, в который входит текущая
   * (`getPartnerIndex`). Нужен только в развороте; `null` — пары нет или
   * рисовать пока нечего.
   */
  partnerSource?: PageRenderSource | null;

  /**
   * План отрисовки прогона: по нему воркер рисует детальный растр, из него же
   * берутся показанная страница и число страниц. `null` — страница ещё не
   * готова.
   */
  plan: RunRenderPlan | null;

  /**
   * Подмена воркера детального растра; по умолчанию — воркер приложения.
   */
  detailDeps?: Partial<DetailRasterDeps>;
};

/**
 * Размер того, что вписывается в область просмотра.
 */
export type ShownPagesSize = {
  /**
   * Ширина в пикселях кадров листов.
   */
  width: number;

  /**
   * Высота в пикселях кадров листов.
   */
  height: number;
};
