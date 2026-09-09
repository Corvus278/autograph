import type { FitPageParams, PagePlacement } from './export.types';

/**
 * Вписывает снимок страницы в сцену по центру. Страница, которая не помещается,
 * уменьшается с сохранением пропорций; масштаб из настроек прибавляется к
 * ширине уже после того, как страница вписана.
 */
export const fitPageIntoScene = (params: FitPageParams): PagePlacement => {
  const { pageWidth, pageHeight, sceneWidth, sceneHeight, scale } = params;

  if (pageWidth <= 0 || pageHeight <= 0) {
    return { width: 0, height: 0, x: sceneWidth / 2, y: sceneHeight / 2 };
  }

  const ratio = pageHeight / pageWidth;
  const factor = Math.min(1, sceneWidth / pageWidth, sceneHeight / pageHeight);
  const width = Math.max(pageWidth * factor + scale, 1);
  const height = width * ratio;

  return {
    width,
    height,
    x: (sceneWidth - width) / 2,
    y: (sceneHeight - height) / 2,
  };
};
