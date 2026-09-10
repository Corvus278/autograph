import type { PageRenderSource } from '../../../model/pageRender.types';

export type PagePreviewProps = {
  /**
   * Источник отрисовки текущей страницы. `null` — рисовать пока нечего.
   */
  source: PageRenderSource | null;
};
