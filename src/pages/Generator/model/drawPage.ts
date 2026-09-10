import type { PageRenderParams } from '../lib/render';
import { renderPageLayers } from '../lib/render';

import type { PageDrawContext } from './pageRender.types';
import type { PageImageSize } from './pageTask.types';

/**
 * Чем закрашивается лист под чернилами. Формат с потерями прозрачности не
 * хранит, и незакрашенная страница вышла бы чёрной.
 */
const PAGE_BASE_COLOR = '#ffffff';

/**
 * Размер снимка страницы в пикселях: страница в канонических пикселях семьи,
 * умноженная на множитель разрешения. Не меньше одного пикселя по каждой
 * стороне — поверхность нулевого размера не создаётся.
 *
 * @param pageWidth — ширина страницы в канонических пикселях
 * @param pageHeight — высота страницы в канонических пикселях
 * @param scale — множитель разрешения отрисовки
 * @returns размер снимка
 */
export const measurePageImage = (
  pageWidth: number,
  pageHeight: number,
  scale: number
): PageImageSize => {
  return {
    width: Math.max(1, Math.round(pageWidth * scale)),
    height: Math.max(1, Math.round(pageHeight * scale)),
  };
};

/**
 * Рисует страницу на готовом контексте: сначала подложка, потом всё, что
 * умеет рендерер.
 *
 * Единственное место, откуда зовётся рендерер снимка: страница на canvas
 * документа и страница на внеэкранном canvas воркера отличаются только тем,
 * откуда взялся контекст, — разойтись им негде.
 *
 * Рендерер идёт в два прохода: фотография листа ложится сюда, а чернила — на
 * свой слой, откуда возвращаются промодулированными освещением и текстурой
 * листа.
 *
 * @param context — контекст рисования
 * @param params — параметры отрисовки вместе с множителем разрешения
 * @param size — размер поверхности в пикселях
 */
export const drawPage = (
  context: PageDrawContext,
  params: PageRenderParams,
  size: PageImageSize
): void => {
  context.fillStyle = PAGE_BASE_COLOR;
  context.fillRect(0, 0, size.width, size.height);
  renderPageLayers(context, params, size);
};
