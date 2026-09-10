import type { SheetImageData } from '../../../../../lib/paper';

/**
 * Веса каналов при переводе цвета в яркость: та же свёртка, что у sRGB-яркости.
 * Разлиновка печатается серым или синим, и по одному зелёному каналу синяя
 * линия почти не видна — поэтому берутся все три.
 */
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;

/**
 * Загружает картинку из data URL.
 *
 * @param src — фотография листа как data URL
 * @returns загруженная картинка; `null` — браузер её не разобрал
 */
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      resolve(null);
    });

    image.src = src;
  });
};

/**
 * Снимает с фотографии полутоновую выжимку — вход всех измерений листа.
 *
 * Пустой результат — обычный рабочий случай, а не сбой: фотография может не
 * разобраться, а канвы для съёма пикселей может не быть вовсе. Экземпляр в
 * этом случае всё равно добавляется, только разлиновку к нему задают руками.
 *
 * @param src — фотография листа как data URL
 * @returns выжимка; `null` — снять её не удалось
 */
export const decodeSheetImage = async (src: string): Promise<SheetImageData | null> => {
  const image = await loadImage(src);

  if (!image) {
    return null;
  }

  const { naturalWidth: width, naturalHeight: height } = image;

  if (width < 1 || height < 1) {
    return null;
  }

  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0);

  const { data } = context.getImageData(0, 0, width, height);
  const luminance = new Float32Array(width * height);

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;

    luminance[index] =
      ((data[offset] || 0) * RED_WEIGHT +
        (data[offset + 1] || 0) * GREEN_WEIGHT +
        (data[offset + 2] || 0) * BLUE_WEIGHT) /
      255;
  }

  return { width, height, luminance };
};
