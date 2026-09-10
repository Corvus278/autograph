import type { RenderImage } from '../lib/render';

import type { CreateMirrorSurface, MirrorSurface } from './pageRender.types';

/**
 * Поверхность отражения на canvas документа.
 *
 * @param width — ширина фотографии в пикселях
 * @param height — высота фотографии в пикселях
 * @returns поверхность вместе с её контекстом
 */
const createCanvasMirrorSurface: CreateMirrorSurface = (width, height) => {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const surface: MirrorSurface = { context: canvas.getContext('2d'), image: canvas };

  return surface;
};

/**
 * Отражает фотографию листа по горизонтали.
 *
 * Отражается именно изображение, а не система координат страницы: чернила на
 * правой половине разворота пишутся в ту же сторону, что и на левой, и общий
 * переворот вывернул бы вместе с листом и текст.
 *
 * Если контекст не дали, возвращается исходное изображение: страница без
 * отражённого фона лучше страницы без фона вовсе.
 *
 * @param image — фотография листа
 * @param width — ширина фотографии в пикселях
 * @param height — высота фотографии в пикселях
 * @param createSurface — чем отражать; в тестах подставляется запись вызовов
 * @returns отражённая фотография
 */
export const mirrorRenderImage = (
  image: RenderImage,
  width: number,
  height: number,
  createSurface: CreateMirrorSurface = createCanvasMirrorSurface
): RenderImage => {
  if (width <= 0 || height <= 0) {
    return image;
  }

  const surface = createSurface(width, height);

  if (!surface.context) {
    return image;
  }

  surface.context.translate(width, 0);
  surface.context.scale(-1, 1);
  surface.context.drawImage(image, 0, 0, width, height);

  return surface.image;
};
