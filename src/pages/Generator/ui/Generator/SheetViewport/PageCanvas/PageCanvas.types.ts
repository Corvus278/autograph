import type { PageRenderSource } from '../../../../model/pageRender.types';

export type PageCanvasProps = {
  /**
   * Источник отрисовки страницы.
   */
  source: PageRenderSource;

  /**
   * Масштаб листа на экране в долях пикселей кадра.
   */
  zoom: number;

  /**
   * Множитель разрешения основного растра — уже с плотностью экрана.
   */
  rasterScale: number;

  /**
   * Адрес детального растра поверх основного; `null` — детального нет.
   */
  detailUrl: string | null;
};
