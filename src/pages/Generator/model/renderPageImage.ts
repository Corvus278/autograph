import { PAGE_IMAGE_MIME } from '../lib/export/pageImageFormat';

import { drawPage, measurePageImage } from './drawPage';
import type { CreatePageSurface, PageImageInput } from './pageRender.types';

/**
 * Поверхность на canvas документа.
 *
 * @param width — ширина снимка в пикселях
 * @param height — высота снимка в пикселях
 * @returns поверхность для растеризации
 */
export const createCanvasSurface: CreatePageSurface = (width, height) => {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  return canvas;
};

/**
 * Растеризует страницу в файл и отдаёт его как data URL.
 *
 * Разрешение задаётся множителем в самих параметрах отрисовки, поэтому снимок
 * отличается от предпросмотра только им: путь отрисовки один и тот же.
 *
 * Путь на главном потоке: он остался ради предпросмотра и тестов, а снимок в
 * полном разрешении уходит в воркер (`createPageRenderClient.ts`) — там та же
 * отрисовка, но без блокировки интерфейса.
 *
 * @param input — параметры отрисовки, размер страницы и качество кодирования
 * @returns data URL готового снимка
 */
export const renderPageImage = (input: PageImageInput): string => {
  const {
    params,
    pageWidth,
    pageHeight,
    quality,
    createSurface = createCanvasSurface,
  } = input;
  const size = measurePageImage(pageWidth, pageHeight, params.scale);
  const surface = createSurface(size.width, size.height);
  const context = surface.getContext('2d');

  if (!context) {
    throw new Error('Браузер не дал контекст canvas');
  }

  drawPage(context, params, size);

  return surface.toDataURL(PAGE_IMAGE_MIME, quality);
};
