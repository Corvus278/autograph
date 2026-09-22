import type { SheetImageData } from './paper.types';

/**
 * Вырезает из изображения полосу столбцов. Нужна детекторам, которые меряют
 * только область с линиями: за её краями лежат пружина блокнота, переплёт и
 * стол, и их провалы трасса приняла бы за линии.
 *
 * @param image — полутоновая выжимка
 * @param from — первый столбец вырезки в пикселях исходного изображения
 * @param width — ширина вырезки в пикселях
 * @returns выжимка шириной `width` той же высоты
 */
export const cropSheetColumns = (
  image: SheetImageData,
  from: number,
  width: number
): SheetImageData => {
  const { width: imageWidth, height, luminance } = image;
  const cropped = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const start = y * imageWidth + from;

    cropped.set(luminance.subarray(start, start + width), y * width);
  }

  return { width, height, luminance: cropped };
};
